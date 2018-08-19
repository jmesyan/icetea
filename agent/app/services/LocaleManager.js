var fs = require('fs'), ini = require('ini');
var pomelo = require("pomelo");
var log = require('pomelo-logger').getLogger("hall", "LocaleManager");
var localeData = require("./StoreDatas").localeData;

var LocaleManager = function() {
	//标识单例
	this.$scope = "singleton";
	this.reloadLocaleData();
	var self = this;
	fs.watch(__dirname + "/../../locale/", function(event, name) {
		var ext = name.split(".").pop();
		if ((event === 'change') || (event === "rename" && (ext == "json" || ext == "txt"))) self.reloadLocaleData();
	});
	this.zh_CN = "zh_CN";
	this.en_US = "en_US";
	this.zh_TW = "zh_TW";
};
var lm = LocaleManager.prototype;

lm.reloadLocaleData = function() {
	var configfile = fs.readFileSync(__dirname + "/../../locale/config.json", 'utf-8');
	configfile = JSON.parse(configfile);
	for (var locale in configfile) {
		var localefile = ini.parse(fs.readFileSync(__dirname + "/../../locale/" + configfile[locale], 'utf-8'));
		if (!!localefile) {
			localeData[locale] = localefile;
			log.warn("Load locale {0} file ok!".format(locale));
		}
	}
};
//获取语言包语言
lm.getLang = function(locale, key, defvalue) {
	try {
		var localefile = localeData[locale];
		if (!!localefile) return localefile[key];
	} catch (e) {
		log.error(e.stack);
		log.error("locale:{0},key:{1},defvalue:{2}".format(locale, key, defvalue));
	}
	if (!!defvalue) return defvalue;
	return key;
};

module.exports = {
	name: "hall",
	beans: [{
		id: "LocaleManager",
		func: LocaleManager,
		scope: "singleton"
	}]
};