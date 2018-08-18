package main

import (
	"golang.org/x/net/context"
	"google.golang.org/grpc"
	pb "icetea/server/protos"
	"io"
	"log"
	"time"
)

func rpcService(client pb.GrpcServiceClient) {
	message := []*pb.GrpcMessage{
		{Cid: 100, Cmd: 200, N: 300, T: 400, Data: []byte("hello")},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
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
			log.Printf("Got message %s at point(%d, %d)", in.Cid, in.Cmd, in.N)
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
