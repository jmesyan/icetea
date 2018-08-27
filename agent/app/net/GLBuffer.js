var log = require('pomelo-logger').getLogger('other', 'GLBuffer');
var slice = Array.prototype.slice;
var zlib = require('zlib');

var GLBuffer = function(bufferLength) {
	this._buffer = new Buffer(bufferLength || 512); //Buffer大于8kb 会使用slowBuffer，效率低
	this.init();
};

var bf = GLBuffer.prototype;

bf.__defineGetter__("datalength", function() {
	if (this._putOffset >= this._readOffset) return this._putOffset - this._readOffset;
	return this._buffer.length - this._readOffset + this._putOffset;
});

bf.init = function() {
	this._headLen = 2;
	this._readMethod = 'readUInt16BE';
	this._headerFunc = null;
	this._headerResult = null;
	this._endian = 'B';

	this._readOffset = 0;
	this._putOffset = 0;
	this._dlen = 0;
	return this;
};

bf.dispose = function() {
	this._headerFunc = null;
	this._headLen = 2;
	this._headerResult = null;
	this._buffer = null;
};

bf.setHeaderProc = function(hlen, func) {
	this._headLen = hlen;
	this._readMethod = 'readUInt' + (8*this._headLen) + '' + this._endian + 'E';
	this._headerFunc = func;
	return this;
};

bf.littleEndian = function() {
	this._endian = 'L';
	this._readMethod = 'readUInt' + (8*this._headLen) + '' + this._endian + 'E';
	return this;
};

bf.bigEndian = function() {
	this._endian = 'B';
	this._readMethod = 'readUInt' + (8*this._headLen) + '' + this._endian + 'E';
	return this;
};

bf.once = function(e, cb) {
	if (!this.listeners_once) this.listeners_once = {};
	this.listeners_once[e] = this.listeners_once[e] || [];
	if (this.listeners_once[e].indexOf(cb) == -1) this.listeners_once[e].push(cb);
};

bf.on = function(e, cb) {
	if (!this.listeners) this.listeners = {};
	this.listeners[e] = this.listeners[e] || [];
	if (this.listeners[e].indexOf(cb) == -1) this.listeners[e].push(cb);
};

bf.off = function(e, cb) {
	var index = -1;
	if (this.listeners && this.listeners[e] && (index = this.listeners[e].indexOf(cb)) != -1)
		this.listeners[e].splice(index);
};

bf.emit = function(e) {
	var other_parameters = slice.call(arguments, 1);
	if (this.listeners) {
		var list = this.listeners[e];
		if (list) for (var i = 0; i < list.length; ++i) list[i].apply(this,other_parameters);
	}
	if (this.listeners_once) {
		var list = this.listeners_once[e];
		delete this.listeners_once[e];
		if(list) for (var i = 0; i < list.length; ++i) list[i].apply(this,other_parameters);
	}
};

bf.put = function(buffer, offset, len) {
	var self = this;
	if (offset == undefined) offset = 0;
	if (len == undefined) len = buffer.length - offset;
	if (len + this.datalength > this._buffer.length) {
		var ex = Math.ceil((len + this.datalength)/(1024)); //每次扩展1kb
		var tmp = new Buffer(ex * 1024);
		var exlen = tmp.length - this._buffer.length;
		this._buffer.copy(tmp);
		if (this._putOffset < this._readOffset) {
			if (this._putOffset <= exlen) {
				tmp.copy(tmp, this._buffer.length, 0, this._putOffset);
				this._putOffset += this._buffer.length;
			} else {
				tmp.copy(tmp, this._buffer.length, 0, exlen);
				tmp.copy(tmp, 0, exlen, this._putOffset);
				this._putOffset -= exlen;
			}
		}
		this._buffer = tmp;
	}
	if (this.datalength == 0) this._putOffset = this._readOffset = 0;
	//判断是否会冲破_buffer尾部
	if ((this._putOffset + len) > this._buffer.length){
		//分两次存 一部分存在数据后面 一部分存在数据前面
		var len1 = this._buffer.length - this._putOffset;
		if (len1 > 0) {
			buffer.copy(this._buffer, this._putOffset, offset, offset + len1);
			offset += len1;
		}
		var len2 = len - len1;
		buffer.copy(this._buffer, 0, offset, offset + len2);
		this._putOffset = len2;
	} else {
		buffer.copy(this._buffer, this._putOffset, offset, offset + len);
		this._putOffset += len;
	}

	var count = 0;
	while (true) {
		count++;
		if (count>1000) break;//1000次还没读完??
		if (this._dlen == 0) {
			if (this.datalength < this._headLen) break; //连包头都读不了
			if (this._buffer.length - this._readOffset >= this._headLen) {
				if (this._headerFunc != null) {
					var hbuf = this._buffer.slice(this._readOffset, this._readOffset + this._headLen);
					this._headerResult = this._headerFunc(hbuf);
					this._dlen = this._headerResult.l;
				} else if (this._headLen <= 4) {
					this._dlen = this._buffer[this._readMethod](this._readOffset);
				}
				this._readOffset += this._headLen;
			} else {
				var hbuf = new Buffer(this._headLen);
				var rlen = 0;
				for (var i = 0, len = (this._buffer.length - this._readOffset); i < len; i++) {
					hbuf[i] = this._buffer[this._readOffset++];
					rlen++;
				}
				this._readOffset = 0;
				for (var i = 0, len = (this._headLen - rlen); i < len; i++) {
					hbuf[rlen+i] = this._buffer[this._readOffset++];
				}
				if (this._headerFunc != null) {
					this._headerResult = this._headerFunc(hbuf);
					this._dlen = this._headerResult.l;
				} else {
					this._dlen = hbuf[this._readMethod](0);
				}
			}
		}

		if (this.datalength >= this._dlen) {
			var dbuff = new Buffer(this._dlen);
			if (this._readOffset + this._dlen > this._buffer.length) {
				var len1 = this._buffer.length - this._readOffset;
				if (len1 > 0) this._buffer.copy(dbuff, 0, this._readOffset, this._readOffset + len1);

				this._readOffset = 0;
				var len2 = this._dlen - len1;
				this._buffer.copy(dbuff, len1, this._readOffset, this._readOffset += len2);
			} else {
				this._buffer.copy(dbuff, 0, this._readOffset, this._readOffset += this._dlen);
			}
			try {
				this._dlen = 0;
				if (this._headerResult && this._headerResult.e) {
					if ((this._headerResult.e & 2048) == 2048) {
						this._headerResult.e ^= 2048;
						zlib.inflate(dbuff, function(err, flatebf) {
							if (!err) {
								self.emit("data", {
									e: this._headerResult.e,
									t: this._headerResult.t,
									b: flatebf
								});
							} else {
								self.emit("data", {
									e: this._headerResult.e,
									t: this._headerResult.t,
									b: dbuff
								});
							}
						});
					} else {
						self.emit("data", {
							e: this._headerResult.e,
							t: this._headerResult.t,
							b: dbuff
						});
					}
				} else {
					self.emit("data", dbuff);
				}
				if (this._readOffset === this._putOffset) break;
			} catch(e) {
				//self.emit("error", e);
				log.error(e.stack);
			}
		} else {
			break;
		}
	}
};

module.exports = GLBuffer;
