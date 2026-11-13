// ==========================================================================
//  ARIYAK STORE - KHQR BAKONG EMVCo GENERATOR (CAMBODIA STANDARD)
// ==========================================================================

const KHR_RATE = 4100; // 1 USD = 4,100 KHR

/**
 * Encodes Tag-Length-Value (TLV) for EMVCo QR string
 * @param {string} tag - 2-character tag
 * @param {string} val - value string
 * @returns {string} formatted TLV
 */
function tlv(tag, val) {
    const len = val.length.toString().padStart(2, '0');
    return tag + len + val;
}

/**
 * EMVCo CRC-16 (CCITT-FALSE: poly 0x1021, init 0xFFFF)
 * @param {string} str - string to calculate checksum for
 * @returns {string} 4-character hex checksum
 */
function calculateCRC16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates an exact-amount KHQR payload following National Bank of Cambodia standard
 * @param {string} bakongId - Merchant Bakong ID or phone number
 * @param {number} amountUsd - Amount in USD
 * @param {string} currency - 'USD' or 'KHR'
 * @returns {string} valid KHQR EMVCo string
 */
function generateExactKHQRPayload(bakongId, amountUsd, currency) {
    const isKhr = currency === 'KHR';
    const currCode = isKhr ? '116' : '840'; // 840=USD, 116=KHR
    const formattedAmount = isKhr ? Math.round(amountUsd * KHR_RATE).toString() : amountUsd.toFixed(2);

    const aid = 'A000000727'; // Bakong AID
    const merchantInfo = tlv('00', aid) + tlv('01', bakongId);

    let payload = '';
    payload += tlv('00', '01');          // Payload Format Indicator
    payload += tlv('01', '12');          // 12 = Dynamic QR (Exact amount encoded)
    payload += tlv('29', merchantInfo);  // Merchant Information
    payload += tlv('52', '5999');        // Merchant Category Code
    payload += tlv('53', currCode);      // Currency Code
    payload += tlv('54', formattedAmount); // Exact Transaction Amount
    payload += tlv('58', 'KH');          // Country Code: Cambodia
    payload += tlv('59', 'ARIYAK STORE'); // Merchant Name
    payload += tlv('60', 'Phnom Penh');  // City
    payload += '6304';                   // CRC tag + length

    return payload + calculateCRC16(payload);
}
