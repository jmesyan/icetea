var pomelo = require('pomelo');
var memcached = require('memcached');
var Promise = require("bluebird");

var Cache = function() {
	//标识单例
	this.$scope = "singleton";
	this.day = 86400;
	this.init();
};
var cache = Cache.prototype;

cache.init = function() {
	var config = pomelo.app.get('memcached');
	if(!config){
		var app=pomelo.app;
		//memcache配置
		app.loadConfig('memcached', app.getBase() + '/config/memcached.json');
		config = pomelo.app.get('memcached');
	}

	this.prefix = config.prefix;
	this.memcache = new memcached(config.host);

	this.q_get = Promise.promisify(this.get);
	this.q_set = Promise.promisify(this.set);
	this.q_delete = Promise.promisify(this.delete);
};

cache.get = function(key, cb) {
	this.memcache.get(this.prefix + key, function(err, json) {
		cb(err, json ? JSON.parse(json) : null);
	});
};
cache.set = function(key, obj, lifetime, cb) {
	var json = JSON.stringify(obj);
	this.memcache.set(this.prefix + key, json, lifetime, function(err, result) {
		if (cb) cb(err, result);
	});
};
cache.delete = function(key, cb) {
	this.memcache.delete(this.prefix + key, function(err, result) {
		if (cb) cb(err, result);
	});
};

//用户信息
cache.getUser = function(uid) {
	var self = this;
	var cacheData = true,
		key = 'Sys_getUserByID_' + uid;
	return self.q_get(key).then(function(list) {
		if (list && list.uid) return list;
		cacheData = false;
		return new Promise(function(resolve) {
			pomelo.app.rpc.db.dbRemote.getUser(null, uid, resolve);
		});
	}).then(function(result) {
		if (result && !cacheData) {
			cacheData = result;
			return self.q_set(key, result, self.day);
		}
		return result;
	}).then(function(result) {
		if (result === true) return cacheData;
		return result;
	});
};
cache.removeUser = function(uid) {
	var key = 'Sys_getUserByID_' + uid;
	this.delete(key, function(err, result) {});
};

//游戏配置
cache.getGameConfig = function(id) {
	var self = this;
	var cacheData = true, key = 'Game_getGameConfig_' + id;
	return self.q_get(key).then(function(list) {
		if (list) return list;
		cacheData = false;
		return new Promise(function(resolve) {
			pomelo.app.rpc.db.dbRemote.getGameConfig(null, id, resolve);
		});
	}).then(function(result) {
		if (result && !cacheData) {
			cacheData = result;
			return self.q_set(key, result, self.day);
		}
		return result;
	}).then(function(result) {
		if (result === true) return cacheData;
		return result;
	});
};
cache.removeGameConfig = function(id) {
	var key = 'Game_getGameConfig_' + id;
	this.delete(key, function(err, result) {});
};
//等级
cache.getGameLevel = function() {
	var self = this;
	var cacheData = true,
			key = 'gameLevel';
	return self.q_get(key).then(function(list) {
		if (list) return list;
		cacheData = false;
		return new Promise(function(resolve) {
			pomelo.app.rpc.db.dbRemote.getGameLevel(null,resolve);
		});
	}).then(function(result) {
		if (result && !cacheData) {
			cacheData = result;
			return self.q_set(key, result, self.day);
		}
		return result;
	}).then(function(result) {
		if (result === true) return cacheData;
		return result;
	});
};

//用户道具
cache.getUserProps = function(uid) {
	var self = this;
	var cacheData = true,
			key = 'P2p_getUserProps_' + uid;
	return self.q_get(key).then(function(list) {
		if (list) return list;
		cacheData = false;
		return new Promise(function(resolve) {
			pomelo.app.rpc.db.dbRemote.getUserProps(null,uid,resolve);
		});
	}).then(function(result) {
		if (result && !cacheData) {
			cacheData = result;
			return self.q_set(key, result, self.day);
		}
		return result;
	}).then(function(result) {
		if (result === true) return cacheData;
		return result;
	});
};
cache.removeUserProp = function(uid){
	var key = 'P2p_getUserProps_' + uid;
	this.delete(key, function(err, result) {});
};

//用户表情
cache.getUserEmojis = function(uid) {
    var self = this;
    var cacheData = true,
        key = 'P2p_getUserEmojis_' + uid;
    return self.q_get(key).then(function(list) {
        if (list) return list;
        cacheData = false;
        return new Promise(function(resolve) {
            pomelo.app.rpc.db.dbRemote.getUserEmojis(null,uid,resolve);
        });
    }).then(function(result) {
        if (result && !cacheData) {
            cacheData = result;
            return self.q_set(key, result, self.day);
        }
        return result;
    }).then(function(result) {
        if (result === true) return cacheData;
        return result;
    });
};
cache.removeUserEmojis = function(uid){
    var key = 'P2p_getUserEmojis_' + uid;
    this.delete(key, function(err, result) {});
}

module.exports = {
	name: "hall",
	beans: [{
		id: "Cache",
		func: Cache,
		scope: "singleton"
	}]
};