import dgram from 'node:dgram';
import { processBindFile } from './parser.js'

const server = dgram.createSocket('udp4');

server.bind(53);

server.on('message', async (msg, rinfo) => {
  let TID = msg.subarray(0, 2); // first two bytes are the transaction ID
  const flagBytes = getFlags(msg.subarray(2, 4)); // next two bytes to get the flags

  const FLAGS = new Buffer.from(parseInt(flagBytes, 2).toString(16), 'hex');

  const [recordsResult, qt, domainParts, askedRecord] = await getRecords(msg.subarray(12));
  const askedRecords = recordsResult[qt].filter(ele => ele.name == askedRecord);

  const ANCOUNT = new Buffer.from(askedRecords.length.toString(16).padStart(4, 0), 'hex');
  const QDCOUNT = new Buffer.from('0001', 'hex'); // 16 bit integer specifying number of entries in question section
  const NSCOUNT = new Buffer.from('0000', 'hex'); // 16 bit integer specifying number of name server records in authority section
  const ARCOUNT = new Buffer.from('0000', 'hex'); // 16 bit integer specifying number of RRs in additional records section

  const domainQuestion = new Buffer.from(buildQuestion(domainParts, qt), 'hex');

  let dnsBody = '';
  for (let record of askedRecords) {
    dnsBody += recordToBytes(qt, record);
  }
  dnsBody = new Buffer.from(dnsBody, 'hex');

  server.send([TID, FLAGS, QDCOUNT, ANCOUNT, NSCOUNT, ARCOUNT, domainQuestion, dnsBody], rinfo.port);
})

function getFlags(flags) {
  const QR = '1'; // A bit field which tells whether message is query(0) or response(1)
  const byte1 = flags.subarray(0, 1);
  const OPCode = bitsExtract(byte1);

  const AA = '1';
  const TC = '0';
  const RD = '0';

  const RA = '0';
  const Z = '000';
  const RCODE = '0000';

  const header1 = QR + OPCode + AA + TC + RD;
  const header2 = RA + Z + RCODE;

  return header1 + header2;
}

function bitsExtract(data) {
  let opcode = '';
  for (let bit = 1; bit < 5; bit++) {
    opcode += ((data.toString().charCodeAt()) & (1 << bit)).toString();
  }
  return opcode
}

async function getRecords(data) {
  const result = getDomain(data);

  const domain = result[0];

  let domainName;
  let askedRecord = '@';
  if (domain.length > 2) {
    askedRecord = result[0][0];
    domainName = result[0][1] + '.' + result[0][2];
  } else {
    domainName = result[0].join('.');
  }

  const qt = getRecordType(result[1]);
  const filePath = `./zones/${domainName}.zone`;
  const records = await processBindFile(filePath);

  return [records, qt, result[0], askedRecord];
}

function getDomain(data) {
  let state = 0;
  let expectedLength = 0;
  let domainString = '';
  let domainParts = [];
  let x = 0;
  let y = 0;

  for (let pair of data.entries()) {
    if (state === 1) {
      domainString += String.fromCharCode(pair[1]);
      x++;

      if (x === expectedLength) {
        domainParts.push(domainString);
        domainString = '';
        state = 0;
        x = 0;
      }

      if (pair[1] === 0) {
        break;
      }
    } else {
      state = 1;
      expectedLength = pair[1];
    }
    y++;
  }

  const recordType = data.slice(y, y + 2);
  return [domainParts, recordType];
}

function buildQuestion(domainParts, recordType) {
  let qBytes = '';

  for (let part of domainParts) {
    qBytes += part.length.toString(16).padStart(2, 0);

    for (let char of part) {
      qBytes += char.charCodeAt(0).toString(16);
    }
  }

  qBytes += '00'; // null byte to terminate the domain name
  qBytes += getRecordTypeHex(recordType)
  qBytes += '00' + '01';

  return qBytes;
}

function recordToBytes(recordType, record) {
  let rBytes = 'c00c';

  rBytes += getRecordTypeHex(recordType);
  rBytes += '00' + '01';
  rBytes += parseInt(record.ttl).toString(16).padStart(8, 0);

  let alphabetDomain = '';
  if (recordType === 'A') {
    rBytes += '00' + '04';

    for (let part of record.data.split('.')) {
      rBytes += parseInt(part).toString(16).padStart(2, 0);
    }
  } else if (recordType === 'SOA') {
    let mname = domainToHex(record.mname);
    let rname = domainToHex(record.rname);
    let serial = stringToHex(record.serial);
    let refresh = stringToHex(record.refresh);
    let retry = stringToHex(record.retry);
    let expire = stringToHex(record.expire);
    let minimum = stringToHex(record.minimum);

    alphabetDomain = mname + rname + serial + refresh + retry + expire + minimum;
  } else {
    alphabetDomain = domainToHex(record.data);
  }

  if (alphabetDomain != '') {
    switch (recordType) {
      case 'CNAME':
        alphabetDomain += '00';
        break
      case 'MX':
        alphabetDomain = parseInt(record.preference).toString(16).padStart(4, 0) + alphabetDomain;
        break
      default:
        break;
    }

    const totalLength = (alphabetDomain.length / 2).toString(16).padStart(4, 0);
    rBytes += totalLength + alphabetDomain;
  }

  return rBytes;
}

function domainToHex(domain) {
  let alphabetDomain = '';
  let alphabetDomainLength = 0;
  let bytes;

  for (const word of domain.split('.')) {
    bytes = '';
    for (const char of word) {
      bytes += char.charCodeAt().toString(16).padStart(2, 0);
    }
    alphabetDomainLength = (bytes.length / 2).toString(16).padStart(2, 0);
    alphabetDomain += alphabetDomainLength + bytes;
  }

  return alphabetDomain;
}

function getRecordType(data) {
  const d = data.toString('hex');

  switch (d) {
    case '0001':
      return 'A';
    case '0002':
      return 'NS';
    case '0005':
      return 'CNAME';
    case '0006':
      return 'SOA';
    case '000c':
      return 'PTR';
    case '000f':
      return 'MX';
    case '0010':
      return 'TXT';

    default:
      return '';
  }
}

function getRecordTypeHex(data) {
  switch (data) {
    case 'A':
      return '0001';
    case 'NS':
      return '0002';
    case 'CNAME':
      return '0005';
    case 'SOA':
      return '0006';
    case 'PTR':
      return '000c';
    case 'MX':
      return '000f';
    case 'TXT':
      return '0010';
    default:
      break;
  }
}