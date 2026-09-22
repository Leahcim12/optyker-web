// Read-only extension: authentication remains in the existing cashier handler.
import {db} from '../optyker-cash-register-api-v2/base.ts';
import {readRecordedBalancesFrom} from './snapshot-reader.mjs';
export async function readRecordedBalances(value:any){return readRecordedBalancesFrom(db,value);}
