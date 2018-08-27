package protos

import (
// "github.com/golang/protobuf/proto"
)

const (
	OGID_CONTROL_REGIS         = iota + 0x2500 //9472 注册
	OGID_CONTROL_USER                          //9473 查看玩家游戏信息
	OGID_CONTROL_GAME_STATE                    //9474 游戏状态信息
	OGID_CONTROL_GATE                          //9475 控制门
	OGID_CONTROL_RUSERS                        //9476 获得房间内的玩家信息
	OGID_CONTROL_USER_GOLDS                    //9477 玩家金币改变
	OGID_CONTROL_KICK_USER                     //9478 控制踢人
	OGID_CONTROL_JOB_TABLE                     //9479 关于包桌:type:0,包桌;1,取消包桌;2,取钱;3,加钱
	OGID_CONTROL_ADD_GOLDS                     //9480 通知玩家加金币
	OGID_CONTROL_MSG                           //9481 通知玩家加金币
	OGID_CONTROL_TABLE_RECORD                  //9482 路子
	OGID_CONTROL_BONUS_GOLDS                   //9483 玩家bonus_golds合并到golds
	OGID_CONTROL_TABLE_CONTROL                 //9484 玩家bonus_golds合并到golds
	OGID_CONTROL_HEART_BEAT                    //9485 心跳
)
