var net = require('net');
var log = require('pomelo-logger').getLogger("hall", "PhpApiServer");

var pomelo = require("pomelo");
var hotHelper = require("./HotHelper");
var GameConst = hotHelper.getGameConst();
var CMD = require('../common/GameConst');

var tools = require("../GameUtils/Tools");
var sys = require("./StoreDatas").sys;
var bs = require("./StoreDatas").bs;
//vip系统
var props = require("./StoreDatas").props;
var emojis = require("./StoreDatas").emojis;
var vipConfig = require("./StoreDatas").vipConfig;
var serversort = require("./StoreDatas").serversort;

var PhpApiServer = function() {};

PhpApiServer.prototype.start = function() {
	var config = pomelo.app.get("apiServerConfig");

	var server = net.createServer(function(socket) {
		var ApiPipe = hotHelper.getApiPipe();
		new ApiPipe(socket); //有客户端连入时
	});
	server.on('error', function(err) { log.error('api server error', err); });
	server.listen(config.serverapiport);

	log.warn('PHP Api Server running at http://127.0.0.1:' + config.serverapiport);

	sys.SYS_MAINTENANCE = true;
	pomelo.app.get("cache").q_get('maintenance').done(function(r){
		//log.info('SYS_MAINTENANCE', r);
		if (r && r.type && r.t) {
			sys.SYS_MAINTENANCE = r.type == 1;
			var time = Math.round(+new Date() / 1000);
			if (r.type && r.time && r.time != 0 && r.type == 1 && time < r.time) {
				sys.MAINTENANCE_TIME2 = r.time;
				log.info('SYS_MAINTENANCE', sys);
			}
		}
	});
	sys.SEND_TICKET = 0;
	pomelo.app.get("cache").getGameConfig(1).done(function(r){
		sys.SEND_TICKET = r;
		log.info('SEND_TICKET', sys);
	});
	//vip系统
	pomelo.app.rpc.db.dbRemote.getGameProps(null,function(r){
		if (r) for(var key in r) props[r[key].pid] = r[key];
		//log.info('props', props);
	});
	pomelo.app.rpc.db.dbRemote.getVipConfig(null,function(r){
		if (r) for(var key in r) vipConfig[r[key].vip_level] = r[key];
		//log.info('vipConfig', vipConfig);
	});
	pomelo.app.rpc.db.dbRemote.getGameEmojis(null, function(r){
        if(r) {
            for(key in r){
                emojis[r[key].eid] = r[key];
            }
        }
        log.info('emojis', JSON.stringify(emojis));
    });
	loadMatchConfig({},{});
};

function loadMatchConfig(obj,match) {
	pomelo.app.rpc.db.dbRemote.getMatchConfig(null,function(r){
		if (r) {
			if(obj.mid) match = bs.ms[obj.mid];
			bs.ms = r; bs.gs = bs.gs || {}; bs.ss = {}; bs.es = bs.es || {}; bs.cs = {}; bs.ts = {}; bs.ur = bs.ur || {};
			bs.bm = bs.bm || {};
			var now = tools.getSystemSecond();
			var today = tools.getTodaySecond();
			for(var key in r) {
				bs.ss[key] = 0;
				if(r[key].ntype == 4) {
					r[key].starttime =  today + r[key].starttime*3600;
					r[key].endtime = r[key].starttime+60*r[key].endtime;
				}
				if (now > r[key].starttime && now < r[key].endtime) {
					bs.gs[r[key].gid] = key;
					bs.ss[key] = 1;
				}
				if (now > r[key].endtime) bs.ss[key] = 2;
				if (!bs.es[key]) bs.es[key] = {};
				if (!bs.ur[key]) bs.ur[key] = {};
				bs.cs[r[key].code] = r[key].mid;
			}
			if(obj.mid){
				match = bs.ms[obj.mid] ? bs.ms[obj.mid] : match;
				if(match){
					var server = pomelo.app.get('gameserverManager').getServerByGSID(match.gsid);
					if(server) {
						console.log("01RLMA" + obj.mid +'|' +obj.type);
						server.sendString("01RLMA" + obj.mid +'|' +obj.type);
					} else {
						console.error("比赛{0}没有中心服务器".format(obj.mid));
					}
					if(obj.type == 0){
						for(var mgsid in serversort){
							if(match.gid == serversort[mgsid].gid){
								var tables = serversort[mgsid].tablesort,mtids = [];
								for (var tid in tables) mtids.push(parseInt(tid));
								if(server) server.n2s(serversort[mgsid].gid,serversort[mgsid].rtype,serversort[mgsid].ridx,"01",JSON.stringify(mtids));
							}
						}
					} else if(obj.type == 1){
						var h = tools.getHour();
						if(match.ntype == 4 && now > match.starttime && now < match.endtime) pomelo.app.get('matchYQServer').matchEnd(match.gid,match.mid);
						if(match.ntype == 2 && h >= match.starttime && h <= match.endtime) pomelo.app.get('matchCGServer').matchEnd(match.gid,match.mid);
						if(match.ntype == 3 && now > match.starttime && now < match.endtime) pomelo.app.get('matchCSServer').matchEnd(match.gid,match.mid);
					}
				}
			}
		}
		log.info('getMatchConfig', JSON.stringify(bs.ms));
		log.info('getMatchConfigss', JSON.stringify(bs.ss));
		log.info('getMatchConfigcs', JSON.stringify(bs.cs));
	});
}

var ignore = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENETDOWN', 'EPIPE', 'ENOENT'];

function ApiPipe(socket) {
	socket.setNoDelay(true);
	this.socket = socket;
	var self = this;
	socket.setTimeout(3000); // 3s

	//注意不要更改这两个方法，热更新不会生效
	socket.on('error', this.onError.bind(this));
	socket.on('close', this.dispose.bind(this));
	socket.on('data', function(data) { self.onData(data); });
}

ApiPipe.prototype.dispose = function() {
	if (this.socket) {
		this.socket.removeAllListeners();
		this.socket.destroy();
	}
	this.socket = null;
};

ApiPipe.prototype.onError = function(err) {
	if (!~ignore.indexOf(err.code)) {
		log.error('api socket error');
		log.error(err.stack);
	}
	this.dispose();
};

ApiPipe.prototype.onData = function(data) {
	var me = this;
	var socket = this.socket;
	var strData = data.toString();
	var strSign = strData.substr(0, 32);
	var strJson = strData.substr(32);
	log.warn('>> api:' + strJson);

	var sign = tools.MD5("php-realbull-api" + strJson);
	if (sign != strSign) return false;

	var obj = JSON.parse(strJson);
	switch (obj.cmd) {
		case "ADD_CARDS": //{uid,bonusgolds,reasontype,reason}
			//如果用户在线 通知游戏服务器加线
			delete obj.cmd;
			delete obj.timestamp;

			var player = pomelo.app.get('usermanager').getOnlineUserSort(obj.uid);
			if (player) {
				player.room_card = parseInt(obj.totals) || 0;
				player.sendMsg(CMD.pushCmd.roomCardsChange, {
					room_card: player.room_card,
					cards: obj.cards,
					card_use:player.card_use
				});
			}

			//log.warn('addRoomCard', JSON.stringify(obj));
			this.sendObj({ answer: true });
			break;
		case "LABA": //{type,text}
			//通知游戏服务器大喇叭
			var channel = pomelo.app.get('channelService').getChannel(GameConst.ChanelName.hall);
			if (channel) channel.pushMessage(GameConst.pushCmd.laba, { type: obj.type, text: obj.text });
			result = { answer: true };
			this.sendObj(result);
			break;
		case "WEBK_USER": //{uids}
			//通知游戏服务器踢用户
			pomelo.app.get('gameserverManager').kickUser(obj.uids);
			result = {
				answer: true
			};
			for (var i in obj.uids) {
				var player = pomelo.app.get('usermanager').getOnlineUserSort(obj.uids[i]);
				if (player && player.tableid) {
					delete player.gsid;
					delete player.tableid;
					delete player.mid;
				}
			}
			this.sendObj(result);
			break;
		case "WEBK_USER2"://[{uid,gsid,tid}]
			pomelo.app.get('gameserverManager').kickUser2(obj.data);
			result = {
				answer: true
			};
			for (var i in obj.data) {
				var uid = obj.data[i].uid;
				var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
				if (player && player.tableid) {
					delete player.gsid;
					delete player.tableid;
					delete player.mid;
				}
			}
			this.sendObj(result);
			break;
		case "CLOSE_GAME": //{uids}
			for(var i in obj.uids) {
				var uid = obj.uids[i];
				var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
				if(player) player.sendMsg(GameConst.pushCmd.closeGame, {});
			}
			this.sendObj({ answer: true });
			break;
		case "SYS_MAINTENANCE": //停机维护
			sys.SYS_MAINTENANCE = obj.type == '1' ? true : false;
			sys.MAINTENANCE_TIME = obj.type == '1' ? obj.t || 0 : 0;
			pomelo.app.get("cm").broadcastPlayerServerReboot({time: sys.MAINTENANCE_TIME});
			break;
		case "getGameListState": //游戏状态
			this.sendObj({ answer: true, info: pomelo.app.get('gameserverManager').getGameListState() });
			break;
		case "setMaintenanceList": //部分服务器维护
			var key = 'SYS_MAINTENANCE_' + obj.id;
			sys[key] = true;
			pomelo.app.get('mjP2PService').clearMaintenanceServer(obj.id);
			break;
		case "UPDATE_CLIENT": //更新版本
			pomelo.app.get("cm").broadcastPlayerUpdateClient({v: obj.v});
			break;
		case "ADD_TICKET":
			var player = pomelo.app.get('usermanager').getOnlineUserSort(obj.uid);
			if(player) {
				player.ticket = parseInt(obj.ticket) || 0;
				player.sendMsg(GameConst.pushCmd.ticketChange, {ticket: obj.ticket, num: obj.num});
			}
			break;
		case "SEND_TICKET":
			sys.SEND_TICKET = parseInt(obj.num) || 0;
			break;
		case "SET_CLIENT_VER":
			//客户端当前登录版本号
			var connectors=pomelo.app.getServersByType("connector");
			for(var i in connectors){
				var serverid=connectors[i].serverId;
				pomelo.app.rpc.connector.gateRemote.setClientVersion.toServer(serverid,obj.v,function () {
					log.warn("Update client ver setting:",serverid);
				});
			}
			//顺便广播当前在线
			pomelo.app.get("cm").broadcastPlayerUpdateClient({v: obj.v});
			break;
		case "CUSTOM_LOGIN":
			//指定玩家进入某个数据或者区域,比如指定某个玩家uid开桌的时候到哪个服务器gsid开哪个桌子tid
			break;
		case "DELETE_SERVER":
			/**
			 * 删除某个服务器,并不是直接执行析构,gameserver或者gamehubserver还存在,
			 * 但是执行里面deletetable等动作,将玩家清理出去,在服务器出现问题的时候使用较好 
			 * 这样可以配合CUSTOM_LOGIN指挥某个玩家进入指定区域
			 */
            var gsid=obj.id;
            var gameserver=hotHelper.getGameServerManager().getServerByGSID(gsid);
            if(gameserver){
                gameserver.isSimDeleted=true;
                gameserver.dispose();
            }
			break;
		case "UPDATEMATCH":
			var match = obj.mid && bs.ms && bs.ms[obj.mid] ? bs.ms[obj.mid] : {};
			loadMatchConfig(obj,match);
			break;
		//vip系统
		case 'VipLevel':
			var player = pomelo.app.get('usermanager').getOnlineUserSort(obj.uid);
			if(player) player.sendMsg(GameConst.pushCmd.vipLevel,{vip_level:obj.vip_level,pid:obj.pid,day:obj.day,need_pay:obj.need_pay});
			break;
		case 'ADD_EXPS':
			pomelo.app.get('mjP2PService').addUserExps(obj.uid,obj.exps);
			break;
		case 'RELOAD_PROPS':
			pomelo.app.rpc.db.dbRemote.getGameProps(null,function(r){
				if(r) for(var key in r) props[r[key].pid] = r[key];
				log.info('reload_props', props);
			});
			break;
		case "USE_PROP": //{uid,pid}
			//如果用户在线,修改用户使用的道具
			var player = pomelo.app.get('usermanager').getOnlineUserSort(obj.uid);
			if (player) player.use_prop = obj.pid ? obj.pid : 0;
			this.sendObj({ answer: true });
			break;
		case "USE_CHAT":
            //如果用户在线,修改用户使用的聊天框
            var player = pomelo.app.get('usermanager').getOnlineUserSort(obj.uid);
            if (player) player.use_chat = obj.pid ? obj.pid : 0;
            this.sendObj({ answer: true });
			break;
		case "USE_AVATAR":
            //如果用户在线,修改用户使用的头像框
            var player = pomelo.app.get('usermanager').getOnlineUserSort(obj.uid);
            if (player) player.use_avatar = obj.pid ? obj.pid : 0;
            this.sendObj({ answer: true });
			break;
		case 'RELOAD_VIP_CONFIG':
			pomelo.app.rpc.db.dbRemote.getVipConfig(null,function(r){
				if(r) for(var key in r) vipConfig[r[key].vip_level] = r[key];
				log.info('reload_vipConfig', vipConfig);
			});
			break;
		case 'RELOAD_EMOJIS':
			pomelo.app.rpc.db.dbRemote.getGameEmojis(null, function(r){
				if(r) {
					for(key in r){
							emojis[r[key].eid] = r[key];
					}
				}
				log.info('reload_emojis', JSON.stringify(emojis));
			});
			break;
		case "FQ_MATCH":
			log.info('FQ_MATCH',obj);
			var uid = parseInt(obj.uid) || 0;
			if(uid > 0){
				for(var gsid in serversort){
					if(serversort[gsid].gid < 10){
						var server = serversort[gsid];
						if(server) server.sendString('01DUSR'+uid);
					}
				}
				var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
				if(player){
					//log.info('FQ_MATCH',player);
					delete player.mid;
					delete player.mlid;
					delete player.type;
					if(player.reload) delete player.sid;
					if(!bs.su) bs.su = {};
					for(var mid in bs.su) if(bs.su[mid][uid]) delete bs.su[mid][uid];
					pomelo.app.get('matchServer').removeUser(uid,player.reload?false:true);
				}
				for(var mid in bs.su) if(bs.su[mid][uid]) delete bs.su[mid][uid];
				for(var mid in bs.es) if(bs.es[mid][uid]) delete bs.es[mid][uid];
			}
			break;
		case "MATCH_TIMES":
			var me = {};
			if(!!obj.uid && !!bs.at) {
				if(!!obj.mids){
					var mids = obj.mids;
					for(var i in mids){
						var mid = mids[i];
						if(!!bs.at[mid]) me[mid] = parseInt(bs.at[mid][obj.uid]) || 0;
					}
				}else{
					for(var mid in bs.at) if(!!bs.at[mid]) me[mid] = parseInt(bs.at[mid][obj.uid]) || 0;
				}
			}
			this.sendObj({ answer: true, info: !!bs.cgt ? bs.cgt : {} ,me:me});
			break;
		case "MATCH_USER":
			var mid = obj.mid;
			var users = mid && !!bs.su && bs.su[mid] ? bs.su[mid] : {};
			this.sendObj({ answer: true, info: users});
			break;
		case "ADD_GOLD": //{uid,bonusgolds,reasontype,reason}
			//如果用户在线 通知游戏服务器加线
			delete obj.cmd;
			delete obj.timestamp;
			var player = pomelo.app.get('usermanager').getOnlineUserSort(obj.uid);
			if (player) {
				player.golds = obj.golds;
				player.bonus_golds = obj.bonus_golds;
				player.sendMsg(CMD.pushCmd.changeGolds, { golds: obj.totals, change: obj.bonusgolds, resontype: obj.resontype });
			}
			pomelo.app.get('gameserverManager').addGolds(obj, function(obj) {
				me.sendObj({ 'answer': obj });
			});
			break;
		case "GOLDS_BLACK_LIST":
			pomelo.app.get("goldService").goldsBlackList(obj.gids, obj.uid, obj.gtype);
			break;
	}
};

ApiPipe.prototype.sendObj = function(obj) {
	var socket = this.socket;
	if (socket && socket.writable) {
		socket.write(JSON.stringify(obj));
	}
	if (socket) socket.end();
};

module.exports = {
	name: "hall",
	beans: [{
		id: "ApiPipe",
		func: ApiPipe
	}, {
		id: "PhpApiServer",
		func: PhpApiServer,
		scope: "singleton"
	}]
};