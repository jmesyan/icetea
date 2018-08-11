// Code generated by protoc-gen-go. DO NOT EDIT.
// source: chat.proto

package protos

import proto "github.com/golang/protobuf/proto"
import fmt "fmt"
import math "math"

// Reference imports to suppress errors if they are not otherwise used.
var _ = proto.Marshal
var _ = fmt.Errorf
var _ = math.Inf

// This is a compile-time assertion to ensure that this generated file
// is compatible with the proto package it is being compiled against.
// A compilation error at this line likely means your copy of the
// proto package needs to be updated.
const _ = proto.ProtoPackageIsVersion2 // please upgrade the proto package

type UserMessage struct {
	Name                 string   `protobuf:"bytes,1,opt,name=Name" json:"Name,omitempty"`
	Content              string   `protobuf:"bytes,2,opt,name=Content" json:"Content,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *UserMessage) Reset()         { *m = UserMessage{} }
func (m *UserMessage) String() string { return proto.CompactTextString(m) }
func (*UserMessage) ProtoMessage()    {}
func (*UserMessage) Descriptor() ([]byte, []int) {
	return fileDescriptor_chat_63cd6599cf316e8e, []int{0}
}
func (m *UserMessage) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_UserMessage.Unmarshal(m, b)
}
func (m *UserMessage) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_UserMessage.Marshal(b, m, deterministic)
}
func (dst *UserMessage) XXX_Merge(src proto.Message) {
	xxx_messageInfo_UserMessage.Merge(dst, src)
}
func (m *UserMessage) XXX_Size() int {
	return xxx_messageInfo_UserMessage.Size(m)
}
func (m *UserMessage) XXX_DiscardUnknown() {
	xxx_messageInfo_UserMessage.DiscardUnknown(m)
}

var xxx_messageInfo_UserMessage proto.InternalMessageInfo

func (m *UserMessage) GetName() string {
	if m != nil {
		return m.Name
	}
	return ""
}

func (m *UserMessage) GetContent() string {
	if m != nil {
		return m.Content
	}
	return ""
}

type NewUser struct {
	Content              string   `protobuf:"bytes,1,opt,name=Content" json:"Content,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *NewUser) Reset()         { *m = NewUser{} }
func (m *NewUser) String() string { return proto.CompactTextString(m) }
func (*NewUser) ProtoMessage()    {}
func (*NewUser) Descriptor() ([]byte, []int) {
	return fileDescriptor_chat_63cd6599cf316e8e, []int{1}
}
func (m *NewUser) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_NewUser.Unmarshal(m, b)
}
func (m *NewUser) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_NewUser.Marshal(b, m, deterministic)
}
func (dst *NewUser) XXX_Merge(src proto.Message) {
	xxx_messageInfo_NewUser.Merge(dst, src)
}
func (m *NewUser) XXX_Size() int {
	return xxx_messageInfo_NewUser.Size(m)
}
func (m *NewUser) XXX_DiscardUnknown() {
	xxx_messageInfo_NewUser.DiscardUnknown(m)
}

var xxx_messageInfo_NewUser proto.InternalMessageInfo

func (m *NewUser) GetContent() string {
	if m != nil {
		return m.Content
	}
	return ""
}

type AllMembers struct {
	Members              []int64  `protobuf:"varint,1,rep,packed,name=Members" json:"Members,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *AllMembers) Reset()         { *m = AllMembers{} }
func (m *AllMembers) String() string { return proto.CompactTextString(m) }
func (*AllMembers) ProtoMessage()    {}
func (*AllMembers) Descriptor() ([]byte, []int) {
	return fileDescriptor_chat_63cd6599cf316e8e, []int{2}
}
func (m *AllMembers) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_AllMembers.Unmarshal(m, b)
}
func (m *AllMembers) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_AllMembers.Marshal(b, m, deterministic)
}
func (dst *AllMembers) XXX_Merge(src proto.Message) {
	xxx_messageInfo_AllMembers.Merge(dst, src)
}
func (m *AllMembers) XXX_Size() int {
	return xxx_messageInfo_AllMembers.Size(m)
}
func (m *AllMembers) XXX_DiscardUnknown() {
	xxx_messageInfo_AllMembers.DiscardUnknown(m)
}

var xxx_messageInfo_AllMembers proto.InternalMessageInfo

func (m *AllMembers) GetMembers() []int64 {
	if m != nil {
		return m.Members
	}
	return nil
}

type JoinResponse struct {
	Code                 int64    `protobuf:"varint,1,opt,name=Code" json:"Code,omitempty"`
	Result               string   `protobuf:"bytes,2,opt,name=Result" json:"Result,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *JoinResponse) Reset()         { *m = JoinResponse{} }
func (m *JoinResponse) String() string { return proto.CompactTextString(m) }
func (*JoinResponse) ProtoMessage()    {}
func (*JoinResponse) Descriptor() ([]byte, []int) {
	return fileDescriptor_chat_63cd6599cf316e8e, []int{3}
}
func (m *JoinResponse) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_JoinResponse.Unmarshal(m, b)
}
func (m *JoinResponse) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_JoinResponse.Marshal(b, m, deterministic)
}
func (dst *JoinResponse) XXX_Merge(src proto.Message) {
	xxx_messageInfo_JoinResponse.Merge(dst, src)
}
func (m *JoinResponse) XXX_Size() int {
	return xxx_messageInfo_JoinResponse.Size(m)
}
func (m *JoinResponse) XXX_DiscardUnknown() {
	xxx_messageInfo_JoinResponse.DiscardUnknown(m)
}

var xxx_messageInfo_JoinResponse proto.InternalMessageInfo

func (m *JoinResponse) GetCode() int64 {
	if m != nil {
		return m.Code
	}
	return 0
}

func (m *JoinResponse) GetResult() string {
	if m != nil {
		return m.Result
	}
	return ""
}

func init() {
	proto.RegisterType((*UserMessage)(nil), "protos.UserMessage")
	proto.RegisterType((*NewUser)(nil), "protos.NewUser")
	proto.RegisterType((*AllMembers)(nil), "protos.AllMembers")
	proto.RegisterType((*JoinResponse)(nil), "protos.JoinResponse")
}

func init() { proto.RegisterFile("chat.proto", fileDescriptor_chat_63cd6599cf316e8e) }

var fileDescriptor_chat_63cd6599cf316e8e = []byte{
	// 172 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0xe2, 0xe2, 0x4a, 0xce, 0x48, 0x2c,
	0xd1, 0x2b, 0x28, 0xca, 0x2f, 0xc9, 0x17, 0x62, 0x03, 0x53, 0xc5, 0x4a, 0xd6, 0x5c, 0xdc, 0xa1,
	0xc5, 0xa9, 0x45, 0xbe, 0xa9, 0xc5, 0xc5, 0x89, 0xe9, 0xa9, 0x42, 0x42, 0x5c, 0x2c, 0x7e, 0x89,
	0xb9, 0xa9, 0x12, 0x8c, 0x0a, 0x8c, 0x1a, 0x9c, 0x41, 0x60, 0xb6, 0x90, 0x04, 0x17, 0xbb, 0x73,
	0x7e, 0x5e, 0x49, 0x6a, 0x5e, 0x89, 0x04, 0x13, 0x58, 0x18, 0xc6, 0x55, 0x52, 0xe6, 0x62, 0xf7,
	0x4b, 0x2d, 0x07, 0xe9, 0x47, 0x56, 0xc4, 0x88, 0xaa, 0x48, 0x8d, 0x8b, 0xcb, 0x31, 0x27, 0xc7,
	0x37, 0x35, 0x37, 0x29, 0xb5, 0xa8, 0x18, 0xa4, 0x0e, 0xca, 0x94, 0x60, 0x54, 0x60, 0xd6, 0x60,
	0x0e, 0x82, 0x71, 0x95, 0xac, 0xb8, 0x78, 0xbc, 0xf2, 0x33, 0xf3, 0x82, 0x52, 0x8b, 0x0b, 0xf2,
	0xf3, 0x8a, 0xc1, 0x4e, 0x71, 0xce, 0x4f, 0x81, 0x38, 0x85, 0x39, 0x08, 0xcc, 0x16, 0x12, 0xe3,
	0x62, 0x0b, 0x4a, 0x2d, 0x2e, 0xcd, 0x81, 0xb9, 0x04, 0xca, 0x4b, 0x82, 0xf8, 0xc6, 0x18, 0x10,
	0x00, 0x00, 0xff, 0xff, 0xfd, 0x1e, 0xd3, 0x06, 0xe2, 0x00, 0x00, 0x00,
}
