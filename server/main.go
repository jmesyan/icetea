package main

import (
	"fmt"
	"github.com/jmesyan/nano"
	"github.com/jmesyan/nano/component"
	// pb "github.com/jmesyan/nano/protos"
	// "github.com/golang/protobuf/proto"
	"github.com/jmesyan/nano/serialize/protobuf"
	"github.com/jmesyan/nano/session"
	// "icetea/server/protos"
	"log"
	"strings"
	"time"
)

var serializer = protobuf.NewSerializer()

type (
	Room struct {
		group *nano.Group
	}

	// RoomManager represents a component that contains a bundle of room
	RoomManager struct {
		component.Base
		timer *nano.Timer
		rooms map[int]*Room
	}
	stats struct {
		component.Base
		timer         *nano.Timer
		outboundBytes int
		inboundBytes  int
	}
)

func (stats *stats) outbound(s *session.Session, msg nano.Message) error {
	stats.outboundBytes += len(msg.Data)
	return nil
}

func (stats *stats) inbound(s *session.Session, msg nano.Message) error {
	stats.inboundBytes += len(msg.Data)
	return nil
}

func (stats *stats) AfterInit() {
	stats.timer = nano.NewTimer(time.Minute, func() {
		println("OutboundBytes", stats.outboundBytes)
		println("InboundBytes", stats.outboundBytes)
	})
}

const (
	testRoomID = 1
	roomIDKey  = "ROOM_ID"
)

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: map[int]*Room{},
	}
}

// AfterInit component lifetime callback
func (mgr *RoomManager) AfterInit() {
	nano.OnSessionClosed(func(s *session.Session) {
		if !s.HasKey(roomIDKey) {
			return
		}
		room := s.Value(roomIDKey).(*Room)
		room.group.Leave(s)
	})
	mgr.timer = nano.NewTimer(time.Minute, func() {
		for roomId, room := range mgr.rooms {
			println(fmt.Sprintf("UserCount: RoomID=%d, Time=%s, Count=%d",
				roomId, time.Now().String(), room.group.Count()))
		}
	})
}

// Join room
func (mgr *RoomManager) Join(a *nano.Agency, msg []byte) error {

	log.Println("join room", a, msg)
	// send, err := serializer.Marshal(msg)
	// if err != nil {
	// 	fmt.Print(err)
	// 	return err
	// }
	// a.Conn.Send(&pb.GrpcMessage{Cid: 0, Cmd: 0, N: 0, T: 0, Route: "good", Data: []byte("welcome")})
	// a.SendMsg("good", []byte("welcome"))
	// a.SendMsg(protos.OGID_CONTROL_REGIS, &protos.RegisterServer{Gid: proto.Int32(1001), Rtype: proto.Int32(1), Ridx: proto.Int32(1)})

	// a.SendMsg(protos.OGID_CONTROL_HEART_BEAT, &protos.ControlHeartBeat{Nowstamp: proto.Int64(time.Now().Unix())})

	// // NOTE: join test room only in demo
	// room, found := mgr.rooms[testRoomID]
	// if !found {
	// 	room = &Room{
	// 		group: nano.NewGroup(fmt.Sprintf("room-%d", testRoomID)),
	// 	}
	// 	mgr.rooms[testRoomID] = room
	// }

	// fakeUID := s.ID() //just use s.ID as uid !!!
	// s.Bind(fakeUID)   // binding session uids.Set(roomIDKey, room)
	// s.Set(roomIDKey, room)
	// s.Push("onMembers", &AllMembers{Members: room.group.Members()})
	// // notify others
	// room.group.Broadcast("onNewUser", &NewUser{Content: fmt.Sprintf("New user: %d", s.ID())})
	// // new user join group
	// room.group.Add(s) // add session to group
	// return s.Response(&JoinResponse{Result: "success"})
	return nil
}

// Message sync last message to all members
func (mgr *RoomManager) Message(a *nano.Agency, msg *[]byte) error {
	// if !s.HasKey(roomIDKey) {
	// 	return fmt.Errorf("not join room yet")
	// }
	// room := s.Value(roomIDKey).(*Room)
	// return room.group.Broadcast("onMessage", msg)
	return nil
}

func main() {
	nano.SetSerializer(protobuf.NewSerializer())
	// rewrite component and handler name
	room := NewRoomManager()
	nano.Register(room,
		component.WithName("room"),
		component.WithNameFunc(strings.ToLower),
	)
	gsid := []string{"1001", "1", "2"}
	addr := ":7873"
	pipeline := nano.NewPipeline()
	// var stats = &stats{}
	// pipeline.Outbound().PushBack(stats.outbound)
	// pipeline.Inbound().PushBack(stats.inbound)
	nano.EnableDebug()
	log.SetFlags(log.LstdFlags | log.Llongfile)
	client := nano.NewNanoClient(gsid, addr, nano.WithPipeline(pipeline))
	client.Start()
}
