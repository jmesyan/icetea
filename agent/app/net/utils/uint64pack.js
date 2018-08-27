function UInt64(low, high) {
	var self = this;
	if (low == undefined || low == null) low = 0;
	if (high == undefined || high == null) high = 0;
	this.low = low;
	this.high = high;

}
UInt64.prototype.fromNumber = function(n) {
	this.low = n;
	this.high = Math.floor(n / 4294967296);
	return this;
};
UInt64.prototype.toNumber = function() {
	return (this.high * 4294967296) + this.low;
};
UInt64.prototype.toString = function(radix) {

	if (radix == undefined || radix < 2 || radix > 36) {
		throw new Error("uint 64 radix error");
	}
	if (this.high == 0) {
		return this.low.toString(radix);
	}
	var digitChars = [];
	var copyOfThis = new UInt64(this.low, this.high);
	while (copyOfThis.high != 0) {
		var digit = copyOfThis.div(radix);
		digitChars.push((digit < 10 ? '0' : 'a').charCodeAt(0) + digit);
	}
	return copyOfThis.low.toString(radix) + String.fromCharCode.apply(String, digitChars.reverse());
};
UInt64.prototype.parseUInt64 = function(str, radix) {

	if (radix == undefined || radix == null) radix = 0;
	if (radix == 0) {
		if (str.search(/^0x/) == 0) {
			radix = 16;
			i = 2;
		} else {
			radix = 10;
		}
	}
	if (radix < 2 || radix > 36) {
		throw new Error("uint 64 radix error");
	}
	str = str.toLowerCase();
	var result = new UInt64();
	for (i = 0; i < str.length; i++) {
		var digit = str.charCodeAt(i);
		if (digit >= '0'.charCodeAt(0) && digit <= '9'.charCodeAt(0)) {
			digit -= '0'.charCodeAt(0)
		} else if (digit >= 'a'.charCodeAt(0) && digit <= 'z'.charCodeAt(0)) {
			digit -= 'a'.charCodeAt(0)
		} else {
			throw new Error("uint 64 digit error");
		}
		if (digit >= radix) {
			throw new Error("uint 64 digit >= radix error");
		}
		result.mul(radix);
		result.add(digit);
	}
	return result
};
/**
 * Division by n.
 * @return The remainder after division.
 */
UInt64.prototype.div = function(n) {
	var modHigh = this.high % n;
	var mod = (low % n + modHigh * 6) % n;
	this.high /= n;
	var newLow = (modHigh * Number(0x100000000) + low) / n;
	this.high += newLow / 0x100000000;
	this.low = newLow;
	return mod;
};
UInt64.prototype.mul = function(n) {
	var newLow = Number(low) * n;
	this.high = newLow / 0x100000000 + Number(this.high) * n;
	this.low = newLow
};
UInt64.prototype.add = function(n) {
	var newLow = Number(low) + n;
	this.high = newLow / 0x100000000 + this.high;
	this.low = newLow;
};
UInt64.prototype.bitwiseNot = function() {
	this.low = ~this.low;
	this.high = ~this.high;
};
module.exports = UInt64;
module.exports.fromNumber = function(n) {
	return new UInt64(n, Math.floor(n / 4294967296))
};

//
//
//var _0x100000000000000 = 0x100000000000000,
//	_0x1000000000000 =	 0x1000000000000,
//	_0x10000000000 =		 0x10000000000,
//	_0x100000000 =			 0x100000000,
//	_0x1000000 =				 0x1000000,
//	_0x10000 =					 0x10000,
//	_0x100 =						 0x100,
//	_0xff =						   0xff,
//	_0x80 =						   0x80;
//
//function toArray( buffer ){
//	var len = buffer.length;
//	var ret = [];
//	for (var i = len-1; i >= 0; i--) {
//		ret.push(buffer[i]);
//	}
//	return ret;
//};
//
//function decodeUInt64(buffer, offset, endian) {
//	var isBigEndian = endian == 'B',
//		_buffer = buffer.slice(offset, offset + 8),
//		bytes = toArray(_buffer),
//		rv = 0,
//		overflow = 0;
//	isBigEndian && bytes.reverse();
//	// avoid overflow
//	if (bytes[0] & _0x80) {
//
//		++overflow;
//		bytes[0] ^= _0xff;
//		bytes[1] ^= _0xff;
//		bytes[2] ^= _0xff;
//		bytes[3] ^= _0xff;
//		bytes[4] ^= _0xff;
//		bytes[5] ^= _0xff;
//		bytes[6] ^= _0xff;
//		bytes[7] ^= _0xff;
//	}
//	rv += bytes[0] * _0x100000000000000;
//	rv += bytes[1] *   _0x1000000000000;
//	rv += bytes[2] *	 _0x10000000000;
//	rv += bytes[3] *	   _0x100000000;
//	rv += bytes[4] *		 _0x1000000;
//	rv += bytes[5] *		   _0x10000;
//	rv += bytes[6] *			 _0x100;
//	rv += bytes[7];
//
//	if (overflow) {
//		rv += 1;
//		rv *= -1;
//	}
//	return rv;
//}
//
//function encodeUInt64(buffer, number, offset, endian) {
//	var isBigEndian = endian == 'B',
//		high = Math.floor(number / _0x100000000),
//		low = number & (_0x100000000 - 1),
//		ret = [ low & _0xff,
//				(low  >>  8) & _0xff,
//				(low  >> 16) & _0xff,
//				(low  >> 24) & _0xff,
//				high & _0xff,
//				(high >>  8) & _0xff,
//				(high >> 16) & _0xff,
//				(high >> 24) & _0xff
//		];
//	isBigEndian && ret.reverse();
//	var _buffer = new Buffer(ret);
//	_buffer.copy(buffer, offset);
//	return buffer;
//}