import fs from 'fs';
import path from 'path';
import { buildBirthTimeInterval, normalizeBirthTimeInput } from '../lib/birthTime';

const ROOT=path.resolve(__dirname,'..');
const read=(file:string)=>fs.readFileSync(path.join(ROOT,file),'utf8');

describe('birth-time honesty',()=>{
  it('never inserts noon for unknown time',()=>{
    const canonical=read('lib/natalChartCanonical.ts');
    const calculator=read('lib/swisseph-calculator.ts');
    expect(canonical).not.toContain("return '12:00'");
    expect(calculator).not.toContain('default_noon');
    expect(calculator).not.toContain("birthHour = 12");
  });

  it('stores unknown time as a full-day interval without angles or houses',()=>{
    const input=normalizeBirthTimeInput({mode:'unknown',legacyBirthTime:''});
    const interval=buildBirthTimeInterval('1989-03-06','Europe/Moscow',input);
    expect(input.localTime).toBeNull();
    expect(interval.referenceUtc).toBeNull();
    expect(interval.sampleUtc.length).toBeGreaterThan(2);
    const calculator=read('lib/swisseph-calculator.ts');
    expect(calculator).toContain("const includeHouses=time.mode!=='unknown'");
  });

  it('accepts only the approved approximate uncertainties',()=>{
    expect(normalizeBirthTimeInput({mode:'approximate',localTime:'23:15',uncertaintyMinutes:15}).uncertaintyMinutes).toBe(15);
    expect(normalizeBirthTimeInput({mode:'approximate',localTime:'23:15',uncertaintyMinutes:30}).uncertaintyMinutes).toBe(30);
    expect(normalizeBirthTimeInput({mode:'approximate',localTime:'23:15',uncertaintyMinutes:60}).uncertaintyMinutes).toBe(60);
    expect(()=>normalizeBirthTimeInput({mode:'approximate',localTime:'23:15',uncertaintyMinutes:45})).toThrow();
  });
});
