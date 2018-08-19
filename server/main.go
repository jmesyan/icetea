package main

import (
	"github.com/jmesyan/nano"
	"github.com/jmesyan/nano/component"
	"github.com/jmesyan/nano/session"
	"log"
)

type stats struct {
	component.Base
	timer         *nano.Timer
	outboundBytes int
	inboundBytes  int
}

func (stats *stats) outbound(s *session.Session, msg nano.Message) error {
	stats.outboundBytes += len(msg.Data)
	return nil
}

func (stats *stats) inbound(s *session.Session, msg nano.Message) error {
	stats.inboundBytes += len(msg.Data)
	return nil
}

func main() {
	pipeline := nano.NewPipeline()
	var stats = &stats{}
	pipeline.Outbound().PushBack(stats.outbound)
	pipeline.Inbound().PushBack(stats.inbound)

	nano.EnableDebug()
	log.SetFlags(log.LstdFlags | log.Llongfile)
	nano.Connect(":7873", nano.WithPipeline(pipeline))
}
