var pomelo = require('pomelo');

var log = require('pomelo-logger').getLogger("hall", "GameServer");
var tools = require("../../gameutils/Tools");

var GameConst = require("../HotHelper").getGameConst();
var Code = require("../HotHelper").getCode();
var CMD = GameConst.CMD;
var hothelper = require("../HotHelper");
var GameTable = GameTable || hothelper.getGameTable();
var ProtoManager = ProtoManager || hothelper.getProtoManager();
var p2p = require("../StoreDatas").p2p;
var bs = require("../StoreDatas").bs;
var serversort = require("../StoreDatas").serversort;
var alltablesort = require("../StoreDatas").alltablesort;
var GameHandlers = hothelper.getGameHandlers();

var fs = require('fs');
var protobuf = require('protocol-buffers');
var messages = protobuf(fs.readFileSync(__dirname+'/../protos/chat.proto'));

var GameServer = function(socket) {
	if (!global.gs_inc_id) {
		global.gs_inc_id = 1;
	} else {
		global.gs_inc_id++;
	}
	this.id = global.gs_inc_id;
	GameTable = GameTable || hothelper.getGameTable();
	this.isFirstMsg = true;
	this._socket = socket;
	log.info(("#" + this.id + "#"),"server create new!");
	var self = this;
	//3s超时，断开
	// this.sto = setTimeout(function() {
	// 	log.error(("#" + self.id + "#"), socket._getpeername(), "go to check server init");
	// 	self.checkInited();
	// }, 3000);
};

var server = GameServer.prototype;
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
server.onReceivePackData = function(call, message) {
	this._socket = call;
	var n = 0;
	var cid = message.cid;
	var cmd = message.cmd;
	var type = message.type;
	var mid = message.mid;
	var route = message.route;
	var data = message.data;
	console.log("the msg is coming", message)
	if (cid > 0) { //消息转发到客户端
		var channel = pomelo.app.get("gamechannel").getChannel(cid);
		if (channel) channel.s2c(cmd, n, data); //消息转发到客户端
		return;
	}

	var body = null;
	if (cmd > 0){
		switch (cmd){
			case CMD.OGID_CONTROL_ADD_GOLDS | CMD.ACK:
				body = ProtoManager.getBody('control_add_golds', data);
				body.gid = this.gid;
				break;
		}
	} else{
		body  = {
			gid:this.gid,
			msg:data.toString()
		}
	}

	if (body) {
		mtypes  = GameConst.Message;
		if (type ==  mtypes.TYPE_RESPONSE){
			if (pomelo.app.get('gameserverManager').execTick(mid, body)) return;
		} else if(type == mtypes.TYPE_PUSH){
			if (GameHandlers[route]) {
				GameHandlers[route](body);
			} else {
				console.warn("can't find the handlers", route);
			}
		}
	} else {
		console.warn("can't anlyse the message", JSON.stringify(message));
	}
	
};



//初始化服务器信息
server.init = function(ridx, rtype, gid) {
	this.gsid = gid + "_" + rtype + "_" + ridx;
	this.ridx = ridx;
	this.rtype = rtype;
	this.gid = gid;
	//this.tables = [];
	this.tablesort = {};
	this.startTime = Date.now();
	this.channels = {};
	this.isFirstMsg = false;
	clearTimeout(this.sto);

	//重连
	if (!!serversort[this.gsid]) {
		var oldserver = serversort[this.gsid];
		//this.tables = oldserver.tables;
		//delete oldserver.tables;
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
server.checkInited = function() {
	this.c = false;
	if (!this.gsid) {
		log.error(("#" + this.id + "#") + "server inited fail!!!!", this._socket);
		this.dispose();
	}
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
				break;
			}
		}
	}
};
//增加桌子
server.addTable = function(table) {
	var gametable = new GameTable().init(this.gsid, table);
	gametable.gameserver = this;
	//if (!this.tables) this.tables = [];
	//this.tables.push(gametable);
	if (!this.tablesort) this.tablesort = {};
	this.tablesort[gametable.tableid] = gametable;
	//全部的桌子索引
	alltablesort[gametable.gsidtid] = gametable;
	return gametable;
};
//获取桌子
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
		//this.tables.splice(this.tables.indexOf(gametable), 1);
		delete alltablesort[gametable.gsidtid];
	}
};
//释放
server.dispose = function() {
	log.error(("#" + this.id + "#") + "============服务器{0}析构开始=====================".format(this.toString()));
	if (!!this._socket) {
		log.error(("#" + this.id + "#"));
		this._socket.end();
		this._socket = null;
		delete this._socket;
		delete serversort[this.gsid];
	}
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
					break;
				}
			}
		}

		delete this.tablesort;
		//delete this.tables;

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
			//delete channel.player.mid;
			channel.player.sendMsg(GameConst.pushCmd.quit, { state: Code.QUIT.GAME_CLOSE });
			channel.destroy();
		}
		delete this.channels;
		//广播全体
		pomelo.app.get("cm").broadcastPlayerServerLeave({ gsid: this.gsid, gid: this.gid, rtype: this.rtype, ridx: this.ridx });
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

server.sendMsg = function(cid, type, mid, route, body){
	if (!!this._socket) {
		var res = {cid:cid, type:type, mid:mid, route:route, data:body}
        this._socket.write(res)
		return true;
	}
	log.error(("#" + this.id + "#") + "服务端已经断开或毁灭:" + str + "," + this.toString());
	return false;
}

server.request = function(cid, mid, route, cmd, data){
	var body = data;
	if (tools.isString(cmd) && cmd.length > 0) {
		body = ProtoManager.encodeBody(cmd, data);
	}
	if (tools.isString(body)) body = new Buffer(body);
	if (!body) {
		log.error("the msg can't set:",JSON.stringify(data));
	}
	return this.sendMsg(cid, GameConst.Message.TYPE_REQUEST,mid, route, body);
}

server.notify = function(cid, route, cmd, data){
	var body = data;
	if (tools.isString(cmd) && cmd.length > 0) {
		body = ProtoManager.encodeBody(cmd, data);
	}
	if (tools.isString(body)) body = new Buffer(body);

	if (!body) {
		log.error("the msg can't set:",JSON.stringify(data));
	}
	return this.sendMsg(cid, GameConst.Message.TYPE_NOTIFY, 0, route, body);x
}


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