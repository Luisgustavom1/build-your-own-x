const net = require('net');

const HEADER_EOF = '\r\n\r\n';


const handleConnection = (requestHandler) => (socket) => {
  socket.once('readable', () => {
    let buffer = Buffer.from('');

    let tmpBuffer;
    let headerRequest;

    while (true) {
      tmpBuffer = socket.read();
      const noData = socket === null;
      if (noData) break;

      buffer = Buffer.concat([buffer, tmpBuffer]);

      let eofIdx = buffer.indexOf(HEADER_EOF);
      if (eofIdx !== -1) {
        let bodyRemaining = buffer.subarray(eofIdx + HEADER_EOF.length);
        headerRequest = buffer.subarray(0, eofIdx).toString();

        socket.unshift(bodyRemaining);
        break;
      }
    }

    const headersRequest = headerRequest.split('\r\n');
    const [method, url, version] = headersRequest.shift().split(' ');
    
    const headers = headersRequest.reduce((acc, curr) => {
      const [key, value] = curr.split(':');
      return {
        ...acc,
        [key.trim().toLowerCase()]: value.trim()
      }
    }, {})

    const request = {
      method,
      url,
      version: version.split('/')[1],
      headers,
      socket
    }

    let status = 200, statusText = 'OK', headersSent = false, isChunked = false;
    const responseHeaders = {
      server: 'lsao-server'
    }

    const writeChunked = (chunk) => {
      const payload = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ''));
      socket.write(`${payload.length.toString(16)}\r\n`);
      socket.write(payload);
      socket.write('\r\n');
    }

    const setHeader = (key, value) => {
      responseHeaders[key.toLowerCase()] = value;
    }

    const sendHeaders = () => {
      if (headersSent) return;
      headersSent = true;

      setHeader('Date', new Date().toUTCString());

      socket.write(`HTTP/1.1 ${status} ${statusText}\r\n`);
      Object.keys(responseHeaders).forEach(key => {
        socket.write(`${key}: ${responseHeaders[key]}\r\n`);
      })
      socket.write('\r\n');
    }

    const response = {
      write(chunk) {
        const noContentLength = !responseHeaders['content-length'];
        if (noContentLength) {
          isChunked = true;
          setHeader('transfer-encoding', 'chunked');
        }

        sendHeaders();

        if (isChunked) {
          writeChunked(chunk);
          return;
        }
        
        socket.write(chunk);
      },
      end(chunk) {
        const noContentLength = !responseHeaders['content-length'];
        if (noContentLength) {
          setHeader('content-length', chunk ? chunk.length : 0);
        }

        sendHeaders();

        if (isChunked) {
          writeChunked(chunk);
          socket.end('0\r\n\r\n');
          return;
        }

        socket.end(chunk);
      },
      setHeader,
      setStatus(newStatus, newStatusText) { status = newStatus, statusText = newStatusText },
      json(data) {
        if (headersSent) {
          throw new Error('Headers already sent');
        }

        const json = Buffer.from(JSON.stringify(data));
        setHeader('content-type', 'application/json; charset=utf-8');
        setHeader('content-length', json.length);
        sendHeaders();
        socket.end(json);
      }
    };

    requestHandler(request, response);
  })
}

function createWebServer(requestHandler) {
  const server = net.createServer()
  server.on('connection', handleConnection(requestHandler));

  return {
    listen: port => server.listen(port)
  }
}

const webServer = createWebServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  const rawBody = req.socket.read();
  const bodyText = rawBody ? rawBody.toString() : '';

  const responseBody = {
    data: bodyText,
    timestamp: new Date().toISOString()
  };

  res.json(responseBody);
});

webServer.listen(3000);