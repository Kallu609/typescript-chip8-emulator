import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

const ROM_DIR = path.join(__dirname, 'roms');
const MEMORY_DUMP_PATH = path.join(__dirname, 'memorydump.hex');

class Chip8 {
  memory: Uint8Array;        // CHIP-8 memory
  pc: number;                // Program counter
  v: Uint8Array;             // Registers V0 -> VF
  I: number;                 // 16-bit register
  stack: Uint8Array;         // Stack, 16 levels
  sp: number;                // Stack pointer
  
  delayTimer: number;        // Both 60Hz, counting to 0
  soundTimer: number;

  gfx: Array<Array<number>>; // 64x32 display
  drawFlag: false;           // Should screen be redrawn

  constructor() {
    this.initialize();
    
    this.loadRom('PONG');

    this.emulationLoop();
  }

  initialize(): void {
    this.memory = new Uint8Array(4096); // 4096 bytes of memory
    this.pc = 0x200;                    // PC starts at 0x200. 0x000 - 0x1FF is where
                                        // the original interpreter usually hangs out.
    this.v  = new Uint8Array(16);       // 16 registers
    this.I  = 0;
    this.stack = new Uint8Array(16);
    this.sp = 0;

    this.loadFontset();
  }

  loadFontset(): void {
    const fontset = [
      0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
      0x20, 0x60, 0x20, 0x20, 0x70, // 1
      0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
      0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
      0x90, 0x90, 0xF0, 0x10, 0x10, // 4
      0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
      0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
      0xF0, 0x10, 0x20, 0x40, 0x40, // 7
      0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
      0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
      0xF0, 0x90, 0xF0, 0x90, 0x90, // A
      0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
      0xF0, 0x80, 0x80, 0x80, 0xF0, // C
      0xE0, 0x90, 0x90, 0x90, 0xE0, // D
      0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
      0xF0, 0x80, 0xF0, 0x80, 0x80  // F
    ];

    // Fontset starts from 0x00 (?)
    for (let i = 0; i < fontset.length; i++) {
      this.memory[i] = fontset[i];
    }
  }

  loadRom(romName: string): void {
    const filePath = path.join(ROM_DIR, romName);
    const buffer = fs.readFileSync(filePath);

    console.log(`ROM Size: ${ buffer.length } bytes`);

    for (let i = 0; i < buffer.length; i++) {
      this.memory[i + 512] = buffer[i];
    }

    this.dumpMemory();
  }

  emulationLoop(): void {
    this.emulateCycle();
  }

  emulateCycle(): void {
    // Fetch Opcode
    
    // Decode Opcode
    // Execute Opcode
  
    // Update timers
  }

  dumpMemory(): void {
    const hexBytes = Array.from(this.memory).map(byte => {
      return byte.toString(16).padStart(2, '0');
    });
    
    const chunks = _.chunk(hexBytes, 16);
    const lines = chunks.map(chunk => chunk.join(' '));

    const dumpText = lines.join('\n');
    fs.writeFileSync(MEMORY_DUMP_PATH, dumpText);
  }
}

export default Chip8;
