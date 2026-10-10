use std::collections::HashMap;
use std::error::Error;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use rustc_serialize::base64::{ToBase64, STANDARD};

extern crate sha1;
extern crate rustc_serialize;

#[cfg(test)]
mod tests;

struct WebSocketClient {
    id: usize,
    addr: SocketAddr,
    socket: TcpStream
}

impl WebSocketClient {
    pub fn new(id: usize, addr: SocketAddr, socket: TcpStream) -> Self {
        Self { id, addr, socket }
    }

    pub async fn run(&mut self) -> Result<(), Box<dyn Error>> {
        let mut buf = [0; 1024];
        let mut read_bytes = 0;

        let headers = loop {
            let n = self.socket.read(&mut buf[read_bytes..]).await?;
            if n == 0 {
                return Ok(());
            }
            read_bytes += n;

            if let Some((headers, _len)) = parse_http_headers(&buf[..read_bytes])? {
                break headers;
            }
        };

        let ws_key = headers.get("sec-websocket-key").ok_or("Missing Sec-WebSocket-Key header")?;

        let response_key = gen_key(ws_key);
        let response = format!(
            "HTTP/1.1 101 Switching Protocols\r\n\
             Upgrade: websocket\r\n\
             Connection: Upgrade\r\n\
             Sec-WebSocket-Accept: {}\r\n\r\n",
            response_key
        );

        self.socket.write_all(response.as_bytes()).await?;
        self.socket.flush().await?;

        println!("WebSocket upgrade complete for: {}", self.id);

        loop {
            let n = self.socket.read(&mut buf).await?;
            if n == 0 {
                println!("Client {} disconnected", self.id);
                break;
            }
            println!("Received {} bytes from client {}", n, self.id);
        }

        Ok(())
    }   
}

fn gen_key(key: &str) -> String {
    let mut m = sha1::Sha1::new();
    let mut buf = [0u8; 20];

    m.update(key.as_bytes());
    m.update("258EAFA5-E914-47DA-95CA-C5AB0DC85B11".as_bytes());

    m.output(&mut buf);

    buf.to_base64(STANDARD)
}

fn parse_http_headers(buf: &[u8]) -> Result<Option<(HashMap<String, String>, usize)>, Box<dyn Error>> {
    let mut headers = [httparse::EMPTY_HEADER; 64];
    let mut req = httparse::Request::new(&mut headers);

    match req.parse(buf)? {
        httparse::Status::Complete(header_length) => {
            let mut header_map = HashMap::new();
            for header in req.headers {
                if header.name.is_empty() { continue; }

                let name = header.name.to_lowercase();
                let value = std::str::from_utf8(header.value)?.trim().to_string();
                header_map.insert(name, value);
            }
            Ok(Some((header_map, header_length)))
        }
        httparse::Status::Partial => Ok(None),
    }
}

struct WebSocketServer {
    addr: SocketAddr,
    clients: Arc<Mutex<HashMap<usize, SocketAddr>>>,
    id_counter: usize
}

impl WebSocketServer {
    pub fn new(addr: &str) -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            addr: addr.parse()?,
            clients: Arc::new(Mutex::new(HashMap::new())),
            id_counter: 1,
        })
    }

    pub async fn run(&mut self) -> Result<(), Box<dyn Error>> {
        let server_socket = TcpListener::bind(self.addr).await.unwrap();
        println!("Server listening on {}", self.addr);

        loop {
            let (socket, accept_addr) = server_socket.accept().await?;
            let id = self.id_counter;
            self.id_counter += 1;

            let mut client = WebSocketClient::new(id, accept_addr, socket);

            println!("Accepted connection from: {}", client.addr);
            self.clients.lock().await.insert(id, accept_addr);

            let clients_ref = Arc::clone(&self.clients);

            // spawn a new task to handle the client connection
            tokio::spawn(async move {
                if let Err(e) = client.run().await {
                    eprintln!("Error handling client {}: {:?}", accept_addr, e);
                }

                clients_ref.lock().await.remove(&id);
                println!("[id: {}] Client {} disconnected and removed from server", id, accept_addr);
            });
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let mut server = WebSocketServer::new("0.0.0.0:10000")?;

    server.run().await?;

    Ok(())
}
