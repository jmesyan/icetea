package main

import (
	"github.com/golang/protobuf/proto"
	"golang.org/x/net/context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	pb "icetea/server/protos"
	"io"
	"log"
	"time"
)

func rpcService(client pb.GrpcServiceClient) {
	test := &pb.JoinResponse{
		Code:   101,
		Result: "hello",
	}
	data, err := proto.Marshal(test)
	if err != nil {
		log.Fatal("marshaling error: ", err)
	}
	message := []*pb.GrpcMessage{
		{Cid: 100, Cmd: 200, N: 300, T: 400, Data: data},
	}
	md := metadata.Pairs("gid", "1001")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	ctx = metadata.NewOutgoingContext(ctx, md)
	defer cancel()

	stream, err := client.MService(ctx)
	if err != nil {
		log.Fatalf("%v.MService(_) = _, %v", client, err)
	}
	waitc := make(chan struct{})
	go func() {
		for {
			in, err := stream.Recv()
			if err == io.EOF {
				// read done.
				close(waitc)
				return
			}
			if err != nil {
				log.Fatalf("Failed to receive a rpcmessage : %v", err)
			}
			userMessage := &pb.UserMessage{}
			err = proto.Unmarshal(in.Data, userMessage)
			if err != nil {
				log.Fatal("unmarshaling error: ", err)
			}
			log.Println(in, userMessage)
		}
	}()
	for _, mes := range message {
		if err := stream.Send(mes); err != nil {
			log.Fatalf("Failed to send a note: %v", err)
		}
	}
	stream.CloseSend()
	<-waitc
}
func main() {
	var opts []grpc.DialOption
	opts = append(opts, grpc.WithInsecure())
	conn, err := grpc.Dial("127.0.0.1:7873", opts...)
	if err != nil {
		log.Fatalf("fail to dial: %v", err)
	}
	defer conn.Close()
	client := pb.NewGrpcServiceClient(conn)
	rpcService(client)
}
