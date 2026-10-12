import test from "node:test";
import assert from "node:assert/strict";
import { billResultStatus, filterResultBills } from "./billResults.js";
const draw = {id:1,top3:"123",top2:"23",bottom2:"45",result_at:"2026-10-12T12:00:00+07:00"};
const now = Date.parse(draw.result_at);
const bills = [
  {id:1,draw_id:1,status:"active",win:100,currency:"THB"},
  {id:2,draw_id:1,status:"active",win:500,currency:"THB"},
  {id:3,draw_id:1,status:"cancelled",win:1000},
  {id:4,draw_id:1,status:"active",win:0},
  {id:5,draw_id:1,status:"active",win:200,currency:"LAK"},
];
test("bill result never shows winner before publication or without complete result",()=>{
  assert.equal(billResultStatus(bills[0],draw,now-1),"pending");
  assert.equal(billResultStatus(bills[0],{...draw,top2:null},now),"pending");
  assert.equal(billResultStatus(bills[0],draw,now),"won");
  assert.equal(billResultStatus(bills[2],draw,now),"cancelled");
  assert.equal(billResultStatus(bills[3],draw,now),"lost");
});
test("prize range and currency filter exclude cancelled and unpublished bills",()=>{
  assert.deepEqual(filterResultBills(bills,[draw],{currency:"THB",min:"150",max:"600",now}).map(b=>b.id),[2]);
  assert.deepEqual(filterResultBills(bills,[draw],{status:"won",currency:"THB",sort:"win",now}).map(b=>b.id),[2,1]);
  assert.deepEqual(filterResultBills(bills,[draw],{min:"0",now:now-1}),[]);
});
