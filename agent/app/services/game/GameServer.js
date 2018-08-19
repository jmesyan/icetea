var pomelo = require('pomelo');

var log = require('pomelo-logger').getLogger("hall", "GameServer");
var tools = require("../../GameUtils/Tools");

var GameConst = require("../HotHelper").getGameConst();
var Code = require("../HotHelper").getCode();
var CMD = GameConst.CMD;
var hothelper = require("../HotHelper");
var GameTable = GameTable || hothelper.getGameTable();
var ProtoManager = ProtoManager || hothelper.getProtoManager();
var ignore = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENETDOWN', 'EPIPE', 'ENOENT'];
var allexps = require("../StoreDatas").exps;
var Promise = require("bluebird");
var bs = require("../StoreDatas").bs;

var GameServer = function() {
	this.initSocket();
};

var server = GameServer.prototype;
server.initSocket=function(){
	this.gamehubServerid=null;
	//等待初始化
	this.isWaitForInited=false;
	//禁止开桌
	this.isDisabled=false;
	//已经模拟被删除状态,一旦进入此状态后不可逆转
	this.isSimDeleted=false;
	this.msgQueue=[];

	if (!global.gs_inc_id) {
		global.gs_inc_id = 1;
	} else {
		global.gs_inc_id++;
	}
	this.id = global.gs_inc_id;
	GameTable = GameTable || hothelper.getGameTable();
	this.isFirstMsg = true;
};

//处理游戏服务器发来的指令，多数是和玩家连接逻辑相关 结束后踢掉死用户
server.execGameServerCmd = function(body) {
	switch (body.cmd) {
		case 2: //2,删除游戏的会话（主动给gameloader发删除会话消息）
			var uid = body.uid;
			var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
			//log.info('player back hall2 delete gsid/tableid:', uid, player.gsid, player.tableid);
			if (player) {
				delete player.gsid;
				delete player.tableid;
				//delete player.mid;
			}
			break;
	}
};
//解包
server.onData = function(cmd,t,body) {
	if (t > 0) { //带tick的 回调执行
		switch (cmd) {
			case CMD.OGID_CONTROL_ADD_GOLDS | CMD.REQ:
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_ROOMSVR_ENTERROOM | CMD.ACK:
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_CONTROL_ONCREATE_TABLE | CMD.REQ:
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_CONTROL_MATCH_USER_SIGN | CMD.REQ:
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_CONTROL_MATCH_USER_RISE | CMD.REQ:
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			default:
				log.error(t, ("#" + this.id + "#") + GameConst.debugCmdInfo(cmd, this.gid));
				return;
		}
	}
	switch (cmd) { //服务端指令解析
		case CMD.OGID_CONTROL_HEART_BEAT | CMD.ACK:
			if (!!body.t) {
				this.sendHeartBeat(body.t);
			} else {
				this.sendHeartBeat();
			}
			break;
		case CMD.OGID_CONTROL_MSG | CMD.ACK:
			this.execGameServerCmd(body);
			break;
		case CMD.OGID_CONTROL_REGIS | CMD.ACK:
			//游戏服务器握手
			log.warn('server start:', body.gid, body.rtype, body.ridx);
			this.init(body.ridx, body.rtype, body.gid);
			break;
		case CMD.OGID_CONTROL_RUSERS | CMD.ACK:
			//游戏服务器初始化数据
			if(this.gid < 10) {
				var self = this;
				//console.log('OGID_CONTROL_RUSERS->'+JSON.stringify(body));
				setTimeout(function(){self.initMatchServers(body.tableinfo);},2000);
			} else {
				this.initTables(body.tableinfo);
				log.info('initTables', this.gsid, JSON.stringify(body.tableinfo));
				pomelo.app.get('mjP2PService').registerTables(this.gsid, body.tableinfo);
			}
			break;
		case CMD.OGID_GAME_MSG | CMD.ACK:
			body.gid = this.gid;
			log.info('control_game_msg', JSON.stringify(body));
			//新玩家进入0;2是离开房间
			if (body.type == 0) { //玩家进入
				var table = this.getTable(body.tid);
				if (!table) {
					//log.info('control_game_msg add table', body.tid);
					this.addTable(body);
					table = this.getTable(body.tid);
				}
				if (!!table) {
					table.addPlayer(body);
					pomelo.app.rpc.db.dbRemote.addUserOnline(null, body);
				} else {
					log.error(("#" + this.id + "#") + "gameserver {0} 新玩家进入 not found table{1}".format(this.gsid, body.tid), JSON.stringify(body));
					log.error(this.gsid, body.tid, JSON.stringify(this.getTableSort()));
				}
			} else if (body.type == 2) { //离开房间
				var table = this.getTable(body.tid);
				if (!!table) {
					table.removePlayer(body);
					pomelo.app.rpc.db.dbRemote.removeUserOnline(null, body.uid);
				} else {
					log.error(("#" + this.id + "#") + "gameserver {0} 离开房间 not found table{1}".format(this.gsid, body.tid), JSON.stringify(body));
					log.error(this.gsid, body.tid, JSON.stringify(this.getTableSort()));
				}
			}
			break;
		case CMD.OGID_CONTROL_CANCEL_TABLE | CMD.ACK:
			body.gid = this.gid;
			if (body.gid > 10000) pomelo.app.get('matchServer').endGame(body);
			else pomelo.app.get('mjP2PService').endGame(body);
			break;
		case CMD.OGID_CONTROL_GAME_END | CMD.ACK:
			body.gid = this.gid;
			//console.log('OGID_CONTROL_GAME_END->'+JSON.stringify(body));
			if (body.gid > 10000) {
				if (body.rel == 1) for(var key in body.nuserend) pomelo.app.get('mjP2PService').addUserExps(body.nuserend[key].uid,10,0);
			} else {
				if (body.rel == 1) {
					var exp = 20;
					if(body.gid == 216) exp = 15;
					else if(body.gid == 210) exp = 10;
					for(var key in body.nuserend){
						pomelo.app.get('mjP2PService').addUserExps(body.nuserend[key].uid,exp,0);
						pomelo.app.rpc.db.dbRemote.addUserRound(null,body.nuserend[key].uid,function(){});
						var player = pomelo.app.get('usermanager').getOnlineUserSort(body.nuserend[key].uid);
						if(player) {
							player.vip_rounds = player.vip_rounds + 1;
							player.sendMsg(GameConst.pushCmd.vip_rounds,{vip_rounds:player.vip_rounds});
						}
					}
				} else if(body.rel == 2) {
					var addExps = {};
					for(var key in body.nuserend) {
						var exp = 0;
						if (body.nuserend[key].changescores > 0) exp += 50;
						if(body.zhuozhu == body.nuserend[key].uid && body.iskouka) exp += 70 * body.fangkashu;
						addExps[body.nuserend[key].uid] = pomelo.app.get('mjP2PService').addUserExps(body.nuserend[key].uid,exp,0);
					}
					Promise.props(addExps).then(function(r){
						for(var uid in r){
							var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
							if(player) player.sendMsg(GameConst.pushCmd.expsAll,r);
						}
						for(var uid in r) allexps[uid] = 0;
					});
				}
			}
			break;
		case CMD.OGID_CONTROL_MATCH_START_END | CMD.ACK:
			pomelo.app.get('matchServer').noticeMatch(body);
			break;
		case CMD.OGID_CONTROL_USER_TUIKA | CMD.ACK://房间满,玩家离开桌子 退卡
			//log.info('OGID_CONTROL_USER_TUIKA', body);
			body.gid = this.gid;
			body.istuika = 1;
			pomelo.app.get('mjP2PService').leaveGame(body);
			break;
		case CMD.OGID_CONTROL_MATCH_DISTRIBUTE_USER | CMD.ACK:
			pomelo.app.get('matchServer').matchEnterRoom(body);
			break;
		case CMD.OGID_CONTROL_MATCH_LAST_ENDROUND | CMD.ACK:
			body.gid = this.gid;body.rtype = this.rtype;body.ridx = this.ridx;
			pomelo.app.get('matchServer').matchLastendround(body);
			break;
		case CMD.OGID_CONTROL_MATCH_RANK | CMD.ACK:
			//log.info('OGID_CONTROL_MATCH_RANK', body);
			pomelo.app.get('matchServer').matchRank(body);
			break;
		case CMD.OGID_CONTROL_MOTOR_SIGN | CMD.ACK:
			pomelo.app.get('matchServer').motorSign(body);
			break;
		case CMD.OGID_CONTROL_MATCH_COMMON_INFO | CMD.ACK:
			var info = eval('(' + body.sinfo + ')');
			pomelo.app.get('matchServer').matchTable(info);
			break;
		case CMD.OGID_CONTROL_USER_GOLDS | CMD.ACK:
			if(this.gid > 1000 && this.gid < 10000) pomelo.app.get('usermanager').changeOnlineUserGolds(body.uid, body.golds);
			break;
		case CMD.GLID_GAMEITEM_PLACE | CMD.REQ:
			pomelo.app.get('goldService').setTablePeopNum(body);
			break;
		case CMD.GLID_GAMEITEM_STANDUP | CMD.REQ:
			pomelo.app.get('goldService').setTablePeopNum(body);
			break;
		default:
			//debug信息
			//if (!baned) log.warn('未执行', ("#" + this.id + "#") + GameConst.debugCmdInfo(cmd, this.gid));
			break;
	}
};

var serversort = require("../StoreDatas").serversort;
var alltablesort = require("../StoreDatas").alltablesort;

//初始化服务器信息
server.init = function(ridx, rtype, gid) {
	this.gsid = gid + "_" + rtype + "_" + ridx;
	this.ridx = ridx;
	this.rtype = rtype;
	this.gid = gid;
	this.tablesort = {};
	this.startTime = Date.now();
	this.channels = {};
	this.isFirstMsg = false;
	clearTimeout(this.sto);

	//重连
	if (!!serversort[this.gsid]) {
		var oldserver = serversort[this.gsid];
		this.tablesort = oldserver.tablesort;
		delete oldserver.tablesort;
		this.channels = oldserver.channels;
		this.startTime = oldserver.startTime;
		delete oldserver.channels;


		log.error(("#" + this.id + "#") + "============新老交替，老服务器{0}析构开始=====================".format(oldserver.id));
		oldserver.dispose();
		serversort[this.gsid] = this;
		for (var tableid in this.tablesort) {
			var table = this.tablesort[tableid];
			table.gameserver = this;
		}
		for (var cid in this.channels) {
			var channel = this.channels[cid];
			channel.server = this;
			pomelo.app.get('gameserverManager').reconnectToGame(channel.player);
		}
	}
	serversort[this.gsid] = this;
};
//初始化游戏服务器
server.initMatchServers = function(mids){
	var mgsids = {};
	if(!bs.ts) bs.ts = {};
	if(!bs.ts[bs.ts]) bs.ts[this.gsid] = [];
	for(var i in mids){
		var mid = mids[i].tid;
		if(bs.ts[this.gsid].indexOf(mid) == -1) bs.ts[this.gsid].push(mid);
		if(!bs.ms[mid]) continue;//比赛不存在,不传gisd
		if(!mgsids[this.gsid]) mgsids[this.gsid] = [];
		if(mgsids[this.gsid].indexOf(bs.ms[mid].gid) == -1) mgsids[this.gsid].push(bs.ms[mid].gid);
		var jusers = eval('(' +mids[i].jusers+ ')');
		if(jusers) for(var j in jusers) {
			jusers[j].mid = mid;
			this.initUserMatch(jusers[j]);
		}
	}
	//log.info('mgids',mgsids);
	for(var tgsid in mgsids){
		for(var mgsid in mgsids[tgsid]){
			//console.log(mgsids[tgsid][mgsid]);
			var mgid = mgsids[tgsid][mgsid];
			for(var i in serversort){
				var tmp = i.split('_');
				if(tmp[0] == mgid){
					var mtables = serversort[i].tablesort;
					//log.info(mtables);
					var mtids = [];
					for(var mtid in mtables) mtids.push(parseInt(mtid));
					//log.info('serversort',tgsid,serversort[tgsid]);
					if(serversort[tgsid]) serversort[tgsid].n2s(tmp[0],tmp[1],tmp[2],"01",JSON.stringify(mtids));
				}
			}
		}
	}
}

server.initUserMatch = function(userinfo){
	var m = bs.ms[userinfo.mid];
	if(!m) return;
	if(m.ntype == 1) pomelo.app.get('matchYQServer').initUser(userinfo);
	if(m.ntype == 2) pomelo.app.get('matchCGServer').initUser(userinfo);
	if(m.ntype == 3) pomelo.app.get('matchCSServer').initUser(userinfo);
}

//nodejs转服务端
server.n2s = function(mgid,mrtype,mridx,cmd,msg){
	cmd = cmd || "00";

	var mgid = ("0000000000" + mgid).substr(-10, 10);
	var mrtype = ("0000000000" + mrtype).substr(-10, 10);
	var mridx = ("0000000000" + mridx).substr(-10, 10);

	msg = "04AAAA" + mgid + cmd + mrtype + mridx + msg;
	//console.log(msg);
	this.sendString(msg);
	return msg;
}

//初始化桌子 [1,2,3]
server.initTables = function(tables) {
	var self = this;
	if (tools.isArray(tables))
		tables.forEach(function(table) { self.addTable(table); });
	if(this.gid > 10000){
		var mtids = [];
		for(var mtid in this.tablesort) mtids.push(parseInt(mtid));
		for(var mid in bs.ms){
			if(bs.ms[mid].gid == this.gid && bs.ms[mid].gsid) {
				var mserver = serversort[bs.ms[mid].gsid];
				if(mserver) mserver.n2s(this.gid,this.rtype,this.ridx,"01",JSON.stringify(mtids));
			}
		}
	}
};
//增加桌子
server.addTable = function(table) {
	var gametable=this.getTable(table.tid);
	if(!gametable){
		gametable = new GameTable();
	}
	gametable.init(this.gsid, table);
	gametable.gameserver = this;
	if (!this.tablesort) this.tablesort = {};
	this.tablesort[gametable.tableid] = gametable;
	//全部的桌子索引
	alltablesort[gametable.gsidtid] = gametable;
	return gametable;
};
/**
 * 获取桌子
 * @param tableid
 * @returns {GameTable}
 */
server.getTable = function(tableid) {
	return this.tablesort && this.tablesort[tableid] ? this.tablesort[tableid] : null;
};
server.getTableSort = function() {
	var list = [];
	for (var k in this.tablesort) list.push(k);
	return list;
};

//移除桌子
server.removeTable = function(tableid) {
	pomelo.app.get('mjP2PService').removeTable(this.gsid, tableid);
	var gametable = this.tablesort[tableid];
	if (!!gametable) {
		gametable.dispose();
		delete this.tablesort[tableid];
		delete alltablesort[gametable.gsidtid];
	}
};
//释放
server.dispose = function() {
	log.error(("#" + this.id + "#") + "============服务器{0}析构开始=====================".format(this.toString()));

	if (!!this.tablesort) {
		var self = this;
		log.info(("#" + this.id + "#") + 'tables.length:', this.getTableCount());
		for (var tableid in this.tablesort) {
			var table = this.tablesort[tableid], tableCount = 0;
			for (var i in table.player_sort) {
				tableCount ++;
				var player = table.player_sort[i];
				//游戏通道
				if (!!player.cid) {
					log.error(("#" + self.id + "#") + "玩家通道存在,析构:{0},{1}".format(player.uid, player.cid));
					var channel = self.channels[player.cid];
					if (!!channel) channel.destroy();
				}
				if (player.__proto__.hasOwnProperty("sendMsg")) {
					player.sendMsg(GameConst.pushCmd.quit, { state: Code.QUIT.GAME_CLOSE, gid: self.gid });
				} else {
					log.error(("#" + self.id + "#") + "非正常player结构" + (typeof player));
					log.error(("#" + self.id + "#"), player);
				}
			}
			if (tableCount > 0) log.warn(("#" + this.id + "#") + 'table:', table.gsid, table.tableid, 'playerCount:', tableCount);
			self.removeTable(table.tableid);
			if(this.gid > 10000) {
				var gsidtid = this.gsid + '_' + tableid;
				if(!!bs.fr) delete bs.fr[gsidtid];
				if(!!bs.ft) delete bs.ft[gsidtid];
			}
		}
		if(this.gid > 10000) {
			for(var mid in bs.ms){
				if(bs.ms[mid].gid == this.gid && bs.ms[mid].gsid) {
					var mserver = serversort[bs.ms[mid].gsid];
					//console.log('mserver',mserver);
					if(mserver) mserver.n2s(this.gid,this.rtype,this.ridx,"02","");
				}
			}
		}
		delete this.tablesort;

		pomelo.app.get('mjP2PService').removeRooms(this.gsid);
	}
	//毁灭所有的通道
	if (!!this.channels) {
		for (var cid in this.channels) {
			var channel = this.channels[cid];
			log.error(("#" + this.id + "#") + "服务器连接断开析构逻辑问题，玩家通道依然存在：{0},p:{1},{2},s:{3}".format(channel.id, channel.player.cid, channel.player.uid, this.gsid));
			log.error(channel.player.uid);
			delete channel.player.gsid;
			delete channel.player.tableid;
			channel.player.sendMsg(GameConst.pushCmd.quit, { state: Code.QUIT.GAME_CLOSE });
			channel.destroy();
		}
		delete this.channels;
		//广播全体
		//pomelo.app.get("cm").broadcastPlayerServerLeave({ gsid: this.gsid, gid: this.gid, rtype: this.rtype, ridx: this.ridx });
		pomelo.app.rpc.db.dbRemote.removeUserOnlineByServer(null, this.gid, this.rtype, this.ridx);
	}

	delete serversort[this.gsid];
	if(this.gid < 10) pomelo.app.get('matchServer').matchEnd(this.gsid);

	var tt = (Date.now() - this.startTime) / 3600000;
	var hh = Math.floor(tt);
	var mm = Math.floor((tt - hh) * 60);
	try {
		log.error(("#" + this.id + "#") + "服务器:{0} 断开,持续:{1}小时{2}分钟".format(this.toString(), hh, mm));
	} catch (e) {
		log.error(("#" + this.id + "#"), e);
		log.error(("#" + this.id + "#") + "服务器:断开,持续:{0}小时{1}分钟".format(hh, mm));
		log.error(("#" + this.id + "#"), this);
	}
};

server.toString = function() {
	var json = {
		gsid: this.gsid,
		gid: this.gid,
		rtype: this.rtype,
		ridx: this.ridx,
		tablenum: this.getTableCount()
	};
	return JSON.stringify(json);
};
server.rpc=function (rpcMethod) {
	var args = Array.prototype.slice.call(arguments, 1);
	args.unshift(this.gamehubServerid);
	// log.info("rpcCall :%s",rpcMethod,JSON.stringify(args));
	pomelo.app.rpc.gamehub.serverRemote[rpcMethod].toServer.apply(null,args);

};
server.sendString = function(str) {
	// pomelo.app.rpc.gamehub.serverRemote.sendString.toServer(this.gamehubServerid,this.gsid,str);
	this.rpc("sendString",this.gsid,str);
	return true;
};

server.sendHeartBeat = function(t) {
	this.sendString("02BEAT" + (t || ""));
};

server.getUserCount = function() {
	var users = 0;
	for (var tableid in this.tablesort) {
		var table = this.tablesort[tableid];
		if (!!table) users = users + table.getPlayerCount();
	}
	return users;
};
server.getTableCount = function() {
	var count = 0;
	for (var tid in this.tablesort) count++;
	return count;
};

server.OnError = function(err) {
	if (!~ignore.indexOf(err.code)) {
		log.error(("#" + this.id + "#"), err);
	}
	this.dispose();
};
server.OnDisconnect = function() {
	this.dispose();
};
server.addGolds = function(userinfo, callback) {
	this.sendString("03ADDG{0}|{1}|{2}|{3}|{4}".format(pomelo.app.get('gameserverManager').getTick(callback), userinfo.uid, userinfo.bonusgolds, userinfo.resontype, userinfo.reason));
};

module.exports = {
	name: "hall",
	beans: [{
		id: "GameServer",
		func: GameServer
	}]
};