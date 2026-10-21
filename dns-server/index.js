import fs from 'fs';
import readline from 'readline';

const recordsType = ['NS', 'A', 'CNAME', 'MX'];

async function processBindFile(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  const soa = {
    multiline: false,
    line: 0,
  };
  let origin, ttl, containsTtl, previousTtl, previousName;
  const records = [];

  recordsType.forEach((recordType) => {
    records[recordType] = [];
  })

  for await (const line of rl) {

    if (line.length > 1) {
      let commentedLine = false

      const l = line.trim()
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ');

      const commentIndex = l.indexOf(';');
      if (commentIndex !== -1) {
        if (commentIndex === 0) {
          l = l.split(';')[0];
        } else {
          commentedLine = true;
        }
      }

      if (!commentedLine) {
        let splittedLine = l.split(' ');
        switch (splittedLine[0]) {
          case '$ORIGIN':
            origin = splittedLine[1];
            break;

          case '$TTL':
            ttl = splittedLine[1];
            break;

          case '$INCLUDE':
            break;

          default:
            if (splittedLine.includes('SOA')) {
              previousName = splittedLine[0];
              soa.mname = splittedLine[3];
              soa.rname = splittedLine[4];

              if (splittedLine.includes(')')) {
                soa.serial = splittedLine[6];
                soa.refresh = splittedLine[7];
                soa.retry = splittedLine[8];
                soa.expire = splittedLine[9];
                soa.title = splittedLine[10];
              } else {
                soa.multiline = true;
                soa.line++;
              }
            }            
          }

        if (soa.multiline) {
          switch (soa.line) {
            case 2:
              soa.serial = splittedLine[0];
              break;
            case 3:
              soa.refresh = splittedLine[0];
              break;
            case 4:
              soa.retry = splittedLine[0];
              break;
            case 5:
              soa.expire = splittedLine[0];
              break;
            case 6:
              soa.ttl = splittedLine[0];
              break;
            default:
              break;
          }

          if (splittedLine.includes(')')) {
            soa.multiline = false;
          }

          soa.line++;
        }

        recordsType.forEach((recordType) => {
          const supportedResource = splittedLine.includes(recordType);
          if (supportedResource) {
            let rr;
            [rr, previousName, previousTtl] = processRr(
              splittedLine, 
              containsTtl, 
              previousTtl, 
              previousName, 
              origin, 
              ttl
            );
            records[recordType].push(rr);
          }
        })
      }
    }
  }

  console.log(soa)
  console.log(records)
}

function processRr(splittedLine, containsTtl, previousTtl, previousName, origin, ttl) {
  const rr = {};
  const totalLength = splittedLine.length;
  const isMx = Number(splittedLine[totalLength - 2]);


  switch (totalLength) {
    case 5:
      for (let index = 0; index < totalLength; index++) {
        const element = splittedLine[index];
        const IsNotIp = !element.includes('.')
        if (IsNotIp && parseInt(element)) {
          if (!isMx) {
            containsTtl = true;
            previousTtl = element;
            splittedLine.splice(index, 1);
          }
          break;
        }
      }

      if (!isMx) {
        previousName = splittedLine[0];
        rr.class = splittedLine[1];
        rr.type = splittedLine[2];
        rr.data = splittedLine[3];
      }

      break;
    
    case 4:
      for (let index = 0; index < totalLength; index++) {
        const element = splittedLine[index];
        const IsNotIp = !element.includes('.')
        if (IsNotIp && parseInt(element)) {
          if (!isMx) {
            containsTtl = true;
            previousTtl = element;
            splittedLine.splice(index, 1);
          }
          break;
        }
      }

      if (containsTtl) { // withou name
        rr.class = splittedLine[0];
        rr.type = splittedLine[1];
        rr.data = splittedLine[2];
      } else {
        if (isMx) {
          previousName = '@';
          rr.class = splittedLine[0];
          rr.type = splittedLine[1];
          rr.preference = splittedLine[2];
          rr.data = splittedLine[3];
        } else {
          previousName = splittedLine[0];
          rr.class = splittedLine[1];
          rr.type = splittedLine[2];
          rr.data = splittedLine[3];
        }
      }

      break;
    
    case 3:
      rr.class = splittedLine[0];
      rr.type = splittedLine[1];
      rr.data = splittedLine[2];
      break;
    
    case 2:
    default:
      break;
  }

  rr.name = previousName || origin;
  rr.ttl = previousTtl || ttl;

  return [rr, previousName, previousTtl];
}

processBindFile('file');