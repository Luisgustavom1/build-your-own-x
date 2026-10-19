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

  for await (const line of rl) {
    let origin, ttl, previousTtl, previousName;
    let records = [];

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
        [rr, previousName, previousTtl] = processRr(splittedLine, containsTtl, previousTtl, previousName, origin, ttl);
        records[recordType].push(rr);
      }
    })
  }  
}