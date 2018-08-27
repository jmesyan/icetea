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
	var cid = message.cid;
	var cmd = message.cmd;
	var n = message.n;
	var t = message.t;
	var data = message.data;

	if (cid > 0) { //消息转发到客户端
		var channel = pomelo.app.get("gamechannel").getChannel(cid);
		if (channel) channel.s2c(cmd, n, data); //消息转发到客户端
		return;
	}

	if (t > 0) { //带tick的 回调执行
		switch (cmd) {		
			case CMD.OGID_CONTROL_ADD_GOLDS | CMD.REQ:
				var body = ProtoManager.getBody('control_add_golds', data);
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_ROOMSVR_ENTERROOM | CMD.ACK:
				var body = ProtoManager.getBody('control_user_enterroom', data);
				body.gid = this.gid;
				//log.info('control_user_enterroom body', JSON.stringify(body));
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_CONTROL_ONCREATE_TABLE | CMD.REQ:
				var body = ProtoManager.getBody('control_oncreate_table', data);
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_CONTROL_MATCH_USER_SIGN | CMD.REQ:
				var body = ProtoManager.getBody('control_match_user_un_or_sign', data);
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_CONTROL_MATCH_USER_RISE | CMD.REQ:
				var body = ProtoManager.getBody('control_match_user_rise', data);
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			case CMD.OGID_CONTROL_TABLE_CHANGE | CMD.REQ:
				var body = ProtoManager.getBody('control_table_change', data);
				body.gid = this.gid;
				if (pomelo.app.get('gameserverManager').execTick(t, body)) return;
				break;
			default:
				log.error(t, ("#" + this.id + "#") + GameConst.debugCmdInfo(cmd, this.gid));
				return;
		}
	}

	var baned = false;
	switch (cmd) { //消息屏蔽显示之用，这样这部分消息就不会被打印到控制台上了
		case CMD.OGID_CONTROL_CLIENT_HEART_BEAT | CMD.ACK:
		case CMD.OGID_CONTROL_HEART_BEAT | CMD.ACK:
		case CMD.OGID_GAME_STATE | CMD.ACK:
		case CMD.GLID_GAMEITEM_PLAYER_SMILIE | CMD.ACK:
		case CMD.GLID_GAMEITEM_BETINFO | CMD.ACK:
		case CMD.GLID_GAMEITEM_BET:
		case CMD.GLID_GAMEITEM_CAN_BET:
		case CMD.GLID_GAMEITEM_BETOVER | CMD.ACK:
		case CMD.OGID_GAME_TURN | CMD.ACK:
		case CMD.GLID_GAME_USER_STATICS:
		case CMD.GLID_GAMEITEM_SIDE_POT | CMD.ACK:
		case CMD.GLID_GAMEITEM_BUYINSURANCE:
		case CMD.GLID_GAMEITEM_INSURANCE_RESULT | CMD.ACK:
		case CMD.GLID_GAMEITEM_STOPCARD:
		case CMD.GLID_GAMEITEM_BOSSCARDINFO | CMD.ACK:
		case CMD.GLID_GAMEITEM_LOTTERYRESULT | CMD.ACK:
		case CMD.GLID_GAMEITEM_JOB:
		case CMD.GLID_GAMEITEM_PARTCARD:
		case CMD.GLID_GAMEITEM_DOUBLE:
		case CMD.GLID_GAME_BANK:
		case CMD.GLID_GAMEITEM_BET | CMD.ACK:
		case CMD.GLID_GAMEITEM_BOSS_INFO | CMD.ACK:
		case CMD.GLID_GAMEITEM_RESULT | CMD.ACK:
		case CMD.GLID_GAMEITEM_NEWCARD:
		case CMD.GLID_GAMEITEM_PAIR_RESULT | CMD.ACK:
		case CMD.GLID_GAMEITEM_DEALDOUBLE | CMD.ACK:
		case CMD.GLID_GAMEITEM_STANDUP:
		case CMD.GLID_GAMEITEM_SHOW_CARDS | CMD.ACK:
		case CMD.GLID_GAMEITEM_USE_PROP:
		case CMD.GLID_GAMEITEM_ARRANGE | CMD.ACK:
		case CMD.GLID_GAMEITEM_JOB_CHANGE | CMD.ACK:
		case CMD.OGID_CONTROL_ADD_GOLDS | CMD.ACK:
		case CMD.OGID_GAME_USERLIST:
		case CMD.GLID_GAMEITEM_CHIPS:
		case CMD.GLID_GAMEITEM_PLACE:
		case CMD.GLID_GAMEITEM_BOSS_INFO:
		case CMD.OGID_GAME_MSG | CMD.ACK:
		case CMD.GLID_GAMEITEM_REBET:
		case CMD.GLID_GAME_RECORD | CMD.ACK:
		case CMD.OGID_CONTROL_RUSERS | CMD.ACK:
		case CMD.OGID_CONTROL_MSG | CMD.ACK:
		case CMD.REQ | CMD.OGID_CONTROL_JOB_TABLE:
		case CMD.OGID_CONTROL_GAME_END | CMD.ACK:
		case CMD.OGID_CONTROL_GAME_STATE | CMD.ACK:
		case CMD.REQ | CMD.OGID_CONTROL_USER_RANKING:
		case CMD.GLID_GAMEITEM_DROP_STARO | CMD.ACK:
		case CMD.OGID_CONTROL_BONUS_GOLDS | CMD.ACK:
		case CMD.OGID_CONTROL_REGIS | CMD.ACK:
		case CMD.GLID_GAMEITEM_SHARK | CMD.ACK:
		case CMD.GLID_GAMEITEM_SHOW_CARD | CMD.ACK:
		case CMD.OGID_CONTROL_TABLE_RECORD|CMD.ACK:
		case CMD.OGID_ROOMSVR_ENTERROOM|CMD.ACK:
		case CMD.GLID_GAMEITEM_CREATE_END|CMD.ACK:
		case CMD.OGID_CONTROL_CANCEL_TABLE|CMD.ACK:
		case CMD.GLID_GAMEITEM_SHOW_CARD|CMD.ACK:
		case CMD.GLID_TEXAS_CANCEL_TABLE|CMD.ACK:
		case CMD.GLID_GAMEITEM_ROOM_INFO|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_HU|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_POP|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_PENG|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_READY|CMD.ACK:
		case CMD.GLID_MAHJONG_SETTLEMENT|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_MSG|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_MOPAI|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_JIESAN|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_KILLP|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_KOUPAI|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_USERINFO|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_TABLEINFO|CMD.ACK:
		case CMD.GLID_MAHJONG_MJCARD_QIANGGANG|CMD.ACK:
		case CMD.GLID_MAHJONG_MJCARD_TING|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_GANG|CMD.ACK:
		case CMD.GLID_MAHJONG_MJCARD|CMD.ACK:
		case CMD.GLID_MAHJONG_OPRATION|CMD.ACK:
		case CMD.GLID_MAHJONG_PLACE|CMD.REQ:
		case CMD.OGID_CONTROL_VARIABLE_MOTOR|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_HUCARD|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_USEREXIT|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_OFFORONLE|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_CHI|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_BUHUA|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_BAIDA|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_GENPAI|CMD.ACK:
		case CMD.GLID_MAHJONG_OPERATION_DEPOSIT|CMD.ACK:
			baned = true;
			break;
		default:
			//log.info('未过滤', ("#" + this.id + "#") + GameConst.debugCmdInfo(cmd, this.gid));
			break;
	}

	switch (cmd) { //服务端指令解析
		case CMD.OGID_CONTROL_CLIENT_HEART_BEAT | CMD.ACK:
			body = ProtoManager.getBody('control_client_heart_beat', data);
			if (body.cid) {
				var channel = pomelo.app.get("gamechannel").getChannel(body.cid);
				if (channel) {
					console.log('control_client_heart_beat channel', channel.player.uid, body.uid, body.cid, channel.id);
				}
			}
			var player = pomelo.app.get("usermanager").getOnlineUserSort(body.uid);
			if (player) {
				console.log('control_client_heart_beat player', player.uid, body.uid, body.cid, player.cid);
				if (player.cid > 0 && body.cid > 0 && player.cid != body.cid) {
					this.sendString('02RSUC{0}|{1}'.format(body.uid, player.cid));
				}
			}
			break;
		case CMD.OGID_CONTROL_HEART_BEAT | CMD.ACK:
			var body = ProtoManager.getBody('control_heart_beat', data);
			console.log("control_heart_beat", JSON.stringify(body))
			if (!!body.nowstamp) {
				this.sendHeartBeat(body.nowstamp);
			} else {
				this.sendHeartBeat();
			}
			break;
		case CMD.OGID_CONTROL_MSG | CMD.ACK:
			var body = ProtoManager.getBody('control_msg', data);
			this.execGameServerCmd(body);
			break;
		case CMD.OGID_CONTROL_REGIS | CMD.ACK:
			//游戏服务器握手
			var body = ProtoManager.getBody('register_server', data);
			log.warn('server start:', body.gid, body.rtype, body.ridx);
			this.init(body.ridx, body.rtype, body.gid);
			break;
		case CMD.OGID_CONTROL_RUSERS | CMD.ACK:
			//游戏服务器初始化数据
			var body = ProtoManager.getBody('control_room_users', data);
			log.info('initTables', this.gsid, JSON.stringify(body.body));
			if(this.gid < 10) {
				var self = this;
				setTimeout(function(){self.initMatchServers(body.tableinfo);},2000);
			} else {
				this.initTables(body.tableinfo);
				pomelo.app.get('mjP2PService').registerTables(this.gsid, body.tableinfo);
			}
			break;
		case CMD.OGID_GAME_MSG | CMD.ACK:
			//新玩家进入0;2是离开房间
			var body = ProtoManager.getBody('control_game_msg', data);
			body.gid = this.gid;
			if (body.type == 0) { //玩家进入
				var table = this.getTable(body.tid);
				if (!table) {
					//log.info('control_game_msg add table', body.tid);
					this.addTable(body.tid);
					table = this.getTable(body.tid);
				}
				if (!!table) {
					table.addPlayer(body);
					pomelo.app.rpc.db.dbRemote.addUserOnline(null, body);
				} else {
					log.error(("#" + this.id + "#") + "gameserver {0} 新玩家进入 not found table{1}".format(this.gsid, body.tid), JSON.stringify(body));
					log.error(this.gsid, body.tid, JSON.stringify(this.getTableSort()));
				}
			} else if (body.type == 2 || body.type == 3) { //离开房间
				var table = this.getTable(body.tid);
				if (!!table) {
					if(body.type == 3){
						var code = 0;
						for (var c in p2p.mj.code) {if(p2p.mj.code[c] == table.gsidtid) {code = c;break}}
						if(code){
							var aaData = p2p.mj.aa[code];
							var cards = aaData && aaData.card ? aaData.card : 0;
							if (aaData && aaData.isaa && cards) {
								pomelo.app.rpc.db.dbRemote.addRoomCards(null, body.uid, cards, Code.GOLD.P2P_REFUND_ROOMCARD, 'aa,tuika1:' + cards, this.gid, code, function(r) {
									var player = pomelo.app.get('usermanager').getOnlineUserSort(body.uid);
									if (r && r.nums > -1 && player) {
										player.room_card = r.nums;
										player.card_use = player.card_use - cards;
										player.sendMsg(GameConst.pushCmd.roomCardsChange, { room_card: player.room_card, cards: cards ,card_use:player.card_use});
										pomelo.app.get('cache').removeUser(uid);
									}
								})
							}
						}
					}
					table.removePlayer(body);
					pomelo.app.rpc.db.dbRemote.removeUserOnline(null, body.uid);
				} else {
					log.error(("#" + this.id + "#") + "gameserver {0} 离开房间 not found table{1}".format(this.gsid, body.tid), JSON.stringify(body));
					log.error(this.gsid, body.tid, JSON.stringify(this.getTableSort()));
				}
			}
			break;
		case CMD.OGID_CONTROL_CANCEL_TABLE | CMD.ACK:
			var body = ProtoManager.getBody('control_cancel_table', data);
			body.gid = this.gid;
			if (body.gid > 10000) pomelo.app.get('matchServer').endGame(body);
			else pomelo.app.get('mjP2PService').endGame(body);
			break;
		case CMD.OGID_CONTROL_GAME_END | CMD.ACK:
			var body = ProtoManager.getBody('control_game_end', data);
			body.gid = this.gid;
			if (body.gid > 10000) {
				//pomelo.app.get('matchServer').updateUserRounds(body);
				// for(var key in body.nuserend) pomelo.app.get('mjP2PService').addUserExps(body.nuserend[key].uid,30);
			} else {
				if (body.rel == 1){
					if([1011,2051,1691].indexOf(this.gid) != -1) {
						pomelo.app.get('goldService').drop(body);
					}
				}	
			}
			break;
		case CMD.OGID_CONTROL_USER_TUIKA | CMD.ACK:
			var body = ProtoManager.getBody('control_user_tuika', data);
			var opentype = parseInt(body.opentype) || 0;
			var code = parseInt(body.code);
			if(code && opentype == 1){
				var uid = body.uid;
				var cards = parseInt(body.cardnum);
				var player = pomelo.app.get('usermanager').getOnlineUserSort(uid);
				if(cards > 0 && uid > 0) pomelo.app.rpc.db.dbRemote.addRoomCards(null, uid, cards, Code.GOLD.P2P_REFUND_ROOMCARD, 'aa,tuika2:' + cards, this.gid, code, function(r) {
					if (r && r.nums > -1 && player) {
						player.room_card = r.nums;
						player.card_use = player.card_use - cards;
						player.sendMsg(GameConst.pushCmd.roomCardsChange, { room_card: player.room_card, cards: cards ,card_use:player.card_use});
						pomelo.app.get('cache').removeUser(uid);
					}
				})
			}
			break;
		case CMD.OGID_CONTROL_MATCH_START_END | CMD.ACK:
			var body = ProtoManager.getBody('control_match_start_end', data);
			body.gid = this.gid;
			pomelo.app.get('matchServer').noticeMatch(body);
			break;
		case CMD.OGID_CONTROL_MATCH_DISTRIBUTE_USER | CMD.ACK:
			var body = ProtoManager.getBody('control_match_distribute_users', data);
			body.gid = this.gid;
			pomelo.app.get('matchServer').matchEnterRoom(body);
			break;
		case CMD.OGID_CONTROL_MATCH_LAST_ENDROUND | CMD.ACK:
			var body = ProtoManager.getBody('control_match_Lastendround', data);
			body.gid = this.gid;
			body.gid = this.gid;body.rtype = this.rtype;body.ridx = this.ridx;
			pomelo.app.get('matchServer').matchLastendround(body);
			break;
		case CMD.OGID_CONTROL_MATCH_RANK | CMD.ACK:
			var body = ProtoManager.getBody('control_match_result', data);
			body.gid = this.gid;
			pomelo.app.get('matchServer').matchRank(body);
			break;
		case CMD.OGID_CONTROL_MOTOR_SIGN | CMD.ACK:
			var body = ProtoManager.getBody('control_match_android_sign', data);
			body.gid = this.gid;
			pomelo.app.get('matchCGServer').motorSign(body);
			break;
        case CMD.OGID_CONTROL_TABLE_STARTTOCTROL | CMD.ACK:
        	var body = ProtoManager.getBody('control_game_mj_starttoctrol', data);
            var gsidtid = this.gid + '_' + body.rtp + '_' + body.rdx + '_' + body.tid;
            var code = body.code;
            var club = p2p.mj.club[code];
            var clubid = !!club ? club.clubid:0;
            if(clubid > 0 && p2p.mj.quickroom[clubid] && p2p.mj.quickroom[clubid][gsidtid]) p2p.mj.quickroom[clubid][gsidtid].state = 1;
            break;
      	case CMD.OGID_CONTROL_TABLE_EMPTY | CMD.ACK:
          	var body = ProtoManager.getBody('control_table_empty', data);
          	body.gid = this.gid;
            pomelo.app.get('goldService').endGame(body);
          	break;
        case CMD.OGID_CONTROL_ADD_ANDROID | CMD.ACK:
            var body = ProtoManager.getBody('control_add_android', data);
            body.gid = this.gid;
            pomelo.app.get('goldService').motorRequest(body);
        case CMD.OGID_CONTROL_USER_GOLDS | CMD.ACK:
            var body = ProtoManager.getBody('control_user_golds', data);
            body.gid = this.gid;
            if(this.gid > 1000 && this.gid < 10000) pomelo.app.get('usermanager').changeOnlineUserGolds(body.uid, body.golds);
            break;
		default:
			//debug信息
			//if (!baned) log.warn('未执行', ("#" + this.id + "#") + GameConst.debugCmdInfo(cmd, this.gid));
			break;
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

// server.sendString = function(str) {
// 	if (!!this._socket) {
// 		if (this._socket.writable) {
// 			this._socket.write(str + "\0");
// 			return true;
// 		}
// 	}
// 	log.error(("#" + this.id + "#") + "服务端已经断开或毁灭:" + str + "," + this.toString());
// 	return false;
// };
server.sendString  = function(route, cid, t, n, msg){
	if (!!this._socket) {
		var res = {route:route, cid:cid, cmd:0, n:n, t:t, data:msg}
        this._socket.write(res)
		return true;
	}
	log.error(("#" + this.id + "#") + "服务端已经断开或毁灭:" + str + "," + this.toString());
	return false;
}

server.sendHeartBeat = function(t) {
	// this.sendString("02BEAT" + (t || ""));
	console.log("send heartbeat");
	this.sendString("room.heartbeat",0,0,0,t);

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