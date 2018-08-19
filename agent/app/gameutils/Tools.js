var moment = require('moment');
var util = require('util');
var self = exports;

//格式化日期 默认YYYYMMDD
exports.getDateKey = function(datekey, format) {
	if (self.isEmpty(format)) {
		format = "YYYYMMDD";
	}
	if (self.isNumber(datekey)) {
		if (datekey < 0 || datekey < 31536000) {
			datekey = self.getSystemSecond() + datekey;
		}
		return moment.unix(datekey).format(format);
	}
	if (self.isEmpty(datekey)) {
		return moment().format(format);
	} else {
		return moment().format(datekey);
	}
};

//生成游戏消息
exports.makeGameMsg = function(cmd, body) {
	return ("000000000" + cmd).substr(-9, 9) + JSON.stringify(body);
};

//取时间相隔多少天
exports.getDateToDateDays = function(stdate, enddate) {
	return Math.abs((self.strtotime(stdate) - self.strtotime(enddate)) / 86400);
};

//时间秒
exports.getSystemSecond = function() {
	return parseInt(Date.now() / 1000);
};
//获取当前小时
exports.getHour = function(){
	var d = new Date();
	return d.getHours();
}

//时间毫秒
exports.getSystemMillSecond = function() {
	return Date.now();
};

//今天
exports.getTodaySecond = function() {
	return self.strtotime(self.getDateKey());
};

//今天结束时间
exports.getTodayLastSeconds = function() {
	return self.strtotime(self.getDateKey()) + 86400 - parseInt(Date.now() / 1000);
};

//字符时间转时间
exports.strtotime = function(datekey, format) {
	if (!format) format = "YYYYMMDD";
	var m = moment(datekey, format);
	return parseInt(m.format("x") / 1000);
};

//选取从start到数组结尾的所有元素
exports.slice_argu = function(arg, start, end) {
	return Array.prototype.slice.call(arg, start, end);
};

//拷贝对象
exports.extend = function() {
	//目标对象
	var target = arguments[0] || {},
		//循环变量,它会在循环时指向需要复制的第一个对象的位置,默认为1
		//如果需要进行深度复制,则它指向的位置为2
		i = 1,
		//实参长度
		length = arguments.length,
		//是否进行深度拷贝
		//深度拷贝情况下,会对对象更深层次的属性对象进行合并和覆盖
		deep = false,
		//用于在复制时记录参数对象
		options,
		//用于在复制时记录对象属性名
		name,
		//用于在复制时记录目标对象的属性值
		src,
		//用于在复制时记录参数对象的属性值
		copy;

	//只有当第一个实参为true时,即需要进行深度拷贝时,执行以下分支
	if (typeof target === "boolean") {
		//deep = true,进行深度拷贝
		deep = target;
		//进行深度拷贝时目标对象为第二个实参,如果没有则默认为空对象
		target = arguments[1] || {};
		//因为有了deep深度复制参数,因此i指向的位置为第二个参数
		i = 2;
	}

	//当目标对象不是一个Object且不是一个Function时(函数也是对象,因此使用jQuery.isFunction进行检查)
	if (typeof target !== "object" && !self.isFunction(target)) {
		//设置目标为空对象
		target = {};
	}

	//如果当前参数中只包含一个{Object}
	//如 $.extend({Object}) 或 $.extend({Boolean}, {Object})
	//则将该对象中的属性拷贝到当前jQuery对象或实例中
	//此情况下deep深度复制仍然有效
	if (length === i) {
		//target = this;这句代码是整个extend函数的核心
		//在这里目标对象被更改,这里的this指向调用者
		//在 $.extend()方式中表示jQuery对象本身
		//在 $.fn.extend()方式中表示jQuery函数所构造的对象(即jQuery类的实例)
		target = this;
		//自减1,便于在后面的拷贝循环中,可以指向需要复制的对象
		--i;
	}

	//循环实参,循环从第1个参数开始,如果是深度复制,则从第2个参数开始
	for (; i < length; i++) {
		//当前参数不为null,undefined,0,false,空字符串时
		//options表示当前参数对象
		if ((options = arguments[i]) != null) {
			//遍历当前参数对象的属性,属性名记录到name
			for (name in options) {
				//src用于记录目标对象中的当前属性值
				src = target[name];
				//copy用于记录参数对象中的当前属性值
				copy = options[name];
				//存在目标对象本身的引用,构成死循环,结束此次遍历
				if (target === copy) continue;
				//如果需要进行深度拷贝,且copy类型为对象或数组
				if (deep && copy && (self.isObject(copy) || self.isArray(copy))) {
					//如果src类型为对象或数组,则clone记录src
					//否则colne记录与copy类型一致的空值(空数组或空对象)
					var clone = src && (self.isObject(src) || self.isArray(src)) ? src : self.isArray(copy) ? [] : {};
					//对copy迭代深度复制
					target[name] = self.extend(deep, clone, copy);
					//如果不需要进行深度拷贝
				} else if (copy !== undefined) {
					//直接将copy复制给目标对象
					target[name] = copy;
				}
			}
		}
	}
	//返回处理后的目标对象
	return target;
};

var crypto = require('crypto');

function MD5(str) {
	var md5sum = crypto.createHash('md5');
	md5sum.update(str, "utf8");
	str = md5sum.digest('hex');
	return str;
}
exports.MD5 = MD5;

//is undefined null
exports.isDefinedAndNonNull = function(key) {
	return typeof key != 'undefined' && key !== null;
};
//is empty
exports.isEmpty = function(key) {
	return !self.isDefinedAndNonNull(key);
};
//is function
exports.isFunction = function(value) {
	return typeof value === 'function';
};
//is number
exports.isNumber = function(x) {
	if (typeof x === 'number') return true;
	if (/^0x[0-9a-f]+$/i.test(x)) return true;
	return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(x);
};

//obj to string
function objectToString(o) {
	return Object.prototype.toString.call(o);
}
//is string
function isString(ar) {
	return typeof ar === 'string';
}
exports.isString = isString;

//is array
function isArray(ar) {
	return Array.isArray(ar) ||
		(typeof ar === 'object' && objectToString(ar) === '[object Array]');
}
exports.isArray = isArray;

//is object
function isObject(arg) {
	return typeof arg === 'object' && arg !== null && objectToString(arg) === '[object Object]';
}
exports.isObject = isObject;

//is bool
function isBoolean(arg) {
	return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

//is regexp
function isRegExp(re) {
	return typeof re === 'object' && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

//is date
function isDate(d) {
	return typeof d === 'object' && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

//is error
function isError(e) {
	return typeof e === 'object' &&
		(objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

//统一用户信息
var VarsMirror = {
	nn: "nickname",
	csex: "sex",
	device: "deviceid",
	Nickname: "nickname",
	UserName: "username",
	Uid: "uid",
	id: "uid",
	UserID: "uid",
	chips: "golds",
	nCoins: "golds",
	tid: "tableid",
	Level: "level",
	SitPos: "pos"
};
exports.FormatGamePlayerInfo = function(userinfo) {
	if (isObject(userinfo))
		for (var key in VarsMirror) {
			var tkey = VarsMirror[key];
			if (!!userinfo[key]) {
				userinfo[tkey] = userinfo[key];
				delete userinfo[key];
			}
		}
	return userinfo;
};

//格式化字串类似c# {0} {1} ...或传入obj按照key匹配
String.prototype.format = function(obj) {
	var formatted = this;

	if (arguments.length > 1 || (!isObject(obj))) {
		for (var i = 0; i < arguments.length; i++) {
			var regexp = new RegExp('\\{' + i + '\\}', 'gi');
			formatted = formatted.replace(regexp, arguments[i]);
		}
	} else {
		for (var i in obj) {
			var regexp = new RegExp('\\{' + i + '\\}', 'gi');
			formatted = formatted.replace(regexp, obj[i]);
		}
	}

	return formatted;
};

//格式化字串类似c#
exports.format = function(source, params) {
	if (isArray(params)) {

	} else if (arguments.length > 2) {
		params = exports.slice_argu(arguments, 1);
	} else {
		params = [params];
	}
	return String.prototype.format.apply(source, params);
};

//日期格式化
Date.prototype.format = function(fmt) { //日期format參數 yyyy-MM-dd HH:mm:ss
	var o = {
		"M+": this.getMonth() + 1,
		"d+": this.getDate(),
		"h+": this.getHours() % 12 == 0 ? 12 : this.getHours() % 12,
		"H+": this.getHours(),
		"m+": this.getMinutes(),
		"s+": this.getSeconds(),
		"q+": Math.floor((this.getMonth() + 3) / 3),
		"S": this.getMilliseconds()
	};
	var week = {
		"0": "\u65e5",
		"1": "\u4e00",
		"2": "\u4e8c",
		"3": "\u4e09",
		"4": "\u56db",
		"5": "\u4e94",
		"6": "\u516d"
	};
	if (/(y+)/.test(fmt)) {
		fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
	}
	if (/(E+)/.test(fmt)) {
		fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "\u661f\u671f" : "\u5468") : "") + week[this.getDay() + ""]);
	}
	for (var k in o) {
		if (new RegExp("(" + k + ")").test(fmt)) {
			fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
		}
	}
	return fmt;
};

//左填充
exports.leftPad = function(nr, n, str) {
	return Array(n - String(nr).length + 1).join(str || '0') + nr;
};

exports.decodeNickName = function(name) {
	if (!name) return '';
	var len = name.length, last = name.lastIndexOf('%');
	if (len == (last + 1)) name = name.substring(0, len - 1);
	len = name.length;
	if (decodeCheck(name)) return decodeURI(name);

	var nickname = name;
	for(var i = 0; i < len; i++) {
		var n = name.substring(0, len - i);
		if (decodeCheck(n)) return decodeURI(n);
	}

	return nickname;
};

function decodeCheck(name) {
	try {
		name = decodeURI(name);
		return true;
	} catch (e) {
		return false;
	}
}

exports.shuffle = function(arr){
	function randomsort(a, b) {
		return Math.random()>.5 ? -1 : 1;
	}
	var arr2 = arr.sort(randomsort);
	return arr2;
};