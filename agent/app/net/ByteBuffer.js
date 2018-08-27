var Type_Byte = 1;
var Type_Short = 2;
var Type_UShort = 3;
var Type_Int32 = 4;
var Type_UInt32 = 5;
var Type_String = 6; //变长字符串，前两个字节表示长度
var Type_VString = 7; //定长字符串
var Type_Int64 = 8;
var Type_Float = 9;
var Type_Double = 10;
var Type_ByteArray = 11;
var Type_Bool = 12;
var Type_Amf3 = 13;
var Type_UInt64 = 14;
var UInt64 = require('./utils/uint64pack');

/*
 * 构造方法
 * @param {Buffer} org_buf 需要解包的二进制
 * @param offset 指定数据在二进制的初始位置 默认是0
 */
var ByteBuffer = function(org_buf, offset) {
	this._buffer = org_buf;
	this._encoding = 'utf8';
	this._offset = offset || 0;
	this._list = [];
	this._endian = 'B';
};

module.exports = ByteBuffer;

var pro = ByteBuffer.prototype;

pro.clear = function(org_buf, offset) {
	this._buffer = org_buf;
	this._encoding = 'utf8';
	this._offset = offset || 0;
	this._list = [];
	this._endian = 'B';
	return this;
};

pro.position = function(newoffset) {
	this._offset = newoffset;
};
//指定文字编码
pro.encoding = function(encode) {
	this._encoding = encode;
	return this;
};

//指定字节序 为BigEndian
pro.bigEndian = function() {
	this._endian = 'B';
	return this;
};

//指定字节序 为LittleEndian
pro.littleEndian = function() {
	this._endian = 'L';
	return this;
};

pro.bool = function(val, index) {
	if (val == undefined || val == null) {
		val = (this._buffer.readInt8(this._offset) == 1);
		this._offset += 1;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_Bool,
			d: val,
			l: 1
		});
		this._offset += 1;
	}
	return this;
};
pro.byte = function(val, index) {
	if (val == undefined || val == null) {
		val = this._buffer.readUInt8(this._offset);
		this._offset += 1;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_Byte,
			d: val,
			l: 1
		});
		this._offset += 1;
	}
	return this;
};

pro.short = function(val, index) {
	if (val == undefined || val == null) {
		val = this._buffer['readInt16' + this._endian + 'E'](this._offset);
		this._offset += 2;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_Short,
			d: val,
			l: 2
		});
		this._offset += 2;
	}
	return this;
};

pro.ushort = function(val, index) {
	if (val == undefined || val == null) {
		val = this._buffer['readUInt16' + this._endian + 'E'](this._offset);
		this._offset += 2;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_UShort,
			d: val,
			l: 2
		});
		this._offset += 2;
	}
	return this;
};

pro.int32 = function(val, index) {
	if (val == undefined || val == null) {
		val = this._buffer['readInt32' + this._endian + 'E'](this._offset);
		this._offset += 4;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_Int32,
			d: val,
			l: 4
		});
		this._offset += 4;
	}
	return this;
};

pro.uint32 = function(val, index) {
	if (val == undefined || val == null) {
		val = this._buffer['readUInt32' + this._endian + 'E'](this._offset);
		this._offset += 4;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_UInt32,
			d: val,
			l: 4
		});
		this._offset += 4;
	}
	return this;
};

/**
 * 变长字符串 前2个字节表示字符串长度
 **/
pro.string = function(val, index) {
	if (val == undefined || val == null) {
		var len = this._buffer['readInt16' + this._endian + 'E'](this._offset);
		this._offset += 2;
		val = this._buffer.toString(this._encoding, this._offset, this._offset + len);
		this._offset += len;
		return val;
	} else {
		var len = 0;
		if (val) len = Buffer.byteLength(val, this._encoding);
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_String,
			d: val,
			l: len
		});
		this._offset += len + 2;
	}
	return this;
};

/**
 * 定长字符串 val为null时，读取定长字符串（需指定长度len）
 **/
pro.vstring = function(val, len, index) {
	if (!len) {
		//			throw new Error('vstring must got len argument');
		return this;
	}
	if (val == undefined || val == null) {
		var vlen = 0; //实际长度
		for (var i = this._offset; i < this._offset + len; i++) {
			if (this._buffer[i] > 0) vlen++;
		}
		val = this._buffer.toString(this._encoding, this._offset, this._offset + vlen);
		this._offset += len;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_VString,
			d: val,
			l: len
		});
		this._offset += len;
	}
	return this;
};

pro.int64 = function(val, index) {
	if (val == undefined || val == null) {
		val = this._buffer['readDouble' + this._endian + 'E'](this._offset);
		this._offset += 8;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_Int64,
			d: val,
			l: 8
		});
		this._offset += 8;
	}
	return this;
};
pro.uint64 = function(val, index) {


	if (val == undefined || val == null) {
		val = new UInt64();
		val.low = this.uint32()
		val.high = this.uint32();
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_UInt64,
			d: val,
			l: 8
		});
		this._offset += 8;
	}
	return this;
};
pro.float = function(val, index) {
	if (val == undefined || val == null) {
		val = this._buffer['readFloat' + this._endian + 'E'](this._offset);
		this._offset += 4;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_Float,
			d: val,
			l: 4
		});
		this._offset += 4;
	}
	return this;
};

pro.double = function(val, index) {
	if (val == undefined || val == null) {
		val = this._buffer['readDouble' + this._endian + 'E'](this._offset);
		this._offset += 8;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_Double,
			d: val,
			l: 8
		});
		this._offset += 8;
	}
	return this;
};

/**
 * 写入或读取一段字节数组
 **/
pro.byteArray = function(val, len, index) {
	if (!len) {
		throw new Error('byteArray must got len argument');
		return this;
	}
	if (val == undefined || val == null) {
		var arr = [];
		for (var i = this._offset; i < this._offset + len; i++) {
			if (i < this._buffer.length) {
				arr.push(this._buffer.readUInt8(i));
			} else {
				arr.push(0);
			}
		}
		val = arr;
		this._offset += len;
		return val;
	} else {
		this._list.splice(index != undefined ? index : this._list.length, 0, {
			t: Type_ByteArray,
			d: val,
			l: len
		});
		this._offset += len;
	}
	return this;
};
pro.errortrace = function() {
	var arr = [];
	if (this._buffer)
		for (var i = 0; i < this._buffer.length; i++) {

			arr.push(this._buffer.readUInt8(i));

		}
	return {
		"arr": arr,
		"list": this._list,
		"this:": this
	};
};
/**
 * 解包成数据数组
 **/
pro.unpack = function() {
	return this._list;
};

/**
 * 打包成二进制,在前面加上2个字节表示包长
 **/
pro.packWithHead = function() {
	return this.pack(true);
};

/**
 * 打包成二进制
 * @param ifHead 是否在前面加上2个字节表示包长
 **/
pro.pack = function(ifHead) {
	this._buffer = new Buffer((ifHead) ? this._offset + 2 : this._offset);
	var offset = 0;
	if (ifHead) {
		this._buffer['writeUInt16' + this._endian + 'E'](this._offset, offset);
		offset += 2;
	}
	for (var i = 0; i < this._list.length; i++) {
		switch (this._list[i].t) {
			case Type_Bool:
				this._buffer.writeInt8(this._list[i].d ? 1 : 0, offset);
				offset += this._list[i].l;
				break;
			case Type_Byte:
				this._buffer.writeUInt8(this._list[i].d, offset);
				offset += this._list[i].l;
				break;
			case Type_Short:
				this._buffer['writeInt16' + this._endian + 'E'](this._list[i].d, offset);
				offset += this._list[i].l;
				break;
			case Type_UShort:
				this._buffer['writeUInt16' + this._endian + 'E'](this._list[i].d, offset);
				offset += this._list[i].l;
				break;
			case Type_Int32:
				this._buffer['writeInt32' + this._endian + 'E'](this._list[i].d, offset);
				offset += this._list[i].l;
				break;
			case Type_UInt32:
				this._buffer['writeUInt32' + this._endian + 'E'](this._list[i].d, offset);
				offset += this._list[i].l;
				break;
			case Type_Amf3:

				this._buffer.binaryWrite(this._list[i].d, offset);

				offset += this._list[i].l;
				break;
			case Type_String:
				//前2个字节表示字符串长度
				this._buffer['writeInt16' + this._endian + 'E'](this._list[i].l, offset);
				offset += 2;
				this._buffer.write(this._list[i].d, this._encoding, offset);
				offset += this._list[i].l;
				break;
			case Type_VString:
				var vlen = Buffer.byteLength(this._list[i].d, this._encoding); //字符串实际长度
				this._buffer.write(this._list[i].d, this._encoding, offset);
				//补齐\0
				for (var j = offset + vlen; j < offset + this._list[i].l; j++) {
					this._buffer.writeUInt8(0, j);
				}
				offset += this._list[i].l;
				break;
			case Type_Int64:
				this._buffer['writeDouble' + this._endian + 'E'](this._list[i].d, offset);
				offset += this._list[i].l;
				break;
			case Type_UInt64:

				if (!(this._list[i].d instanceof UInt64)) {
					this._list[i].d = new UInt64().fromNumber(this._list[i].d);

				}
				this._buffer['writeUInt32' + this._endian + 'E'](this._list[i].d.low, offset);
				this._buffer['writeUInt32' + this._endian + 'E'](this._list[i].d.high, offset + 4);

				offset += this._list[i].l;
				break;
			case Type_Float:
				this._buffer['writeFloat' + this._endian + 'E'](this._list[i].d, offset);
				offset += this._list[i].l;
				break;
			case Type_Double:
				this._buffer['writeDouble' + this._endian + 'E'](this._list[i].d, offset);
				offset += this._list[i].l;
				break;
			case Type_ByteArray:
				var indx = 0;
				for (var j = offset; j < offset + this._list[i].l; j++) {
					if (indx < this._list[i].d.length) {
						this._buffer.writeUInt8(this._list[i].d[indx], j);
					} else { //不够的话，后面补齐0x00
						this._buffer.writeUInt8(0, j);
					}
					indx++
				}
				offset += this._list[i].l;
				break;
		}
	}
	return this._buffer;
};

/**
 * 未读数据长度
 **/
pro.getAvailable = function() {
	if (!this._buffer) return this._offset;
	return this._buffer.length - this._offset;
};