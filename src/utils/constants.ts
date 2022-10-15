import { Request } from "express";

export interface TransferData {
  name: string;
  size: number;
  type: string;
  room: string;
  fileid: string;
  sender: string;
  transferid: string;
}

export interface MulterRequest extends Request {
  file: any;
}
