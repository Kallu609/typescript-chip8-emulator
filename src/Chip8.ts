import * as fs from 'fs';
import * as _ from 'lodash';
import * as path from 'path';

const ROM_DIR = path.join(__dirname, 'roms');
const MEMORY_DUMP_PATH = path.join(__dirname, 'memorydump.hex');

class Chip8 {
  memory: Uint8Array;        // CHIP-8 memory
  pc: number;                // Program counter
  V: Uint8Array;             // Registers V0 -> VF
  I: number;                 // 16-bit register
  stack: Uint8Array;         // Stack, 16 levels
  sp: number;                // Stack pointer
  // opcode: number;         // Current opcode
  
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
    this.V  = new Uint8Array(16);       // 16 registers
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
    while (true) {
      this.emulateCycle();
    }
  }

  emulateCycle(): void {
    // Fetch Opcode
    const opcode = this.memory[this.pc] << 8  | this.memory[this.pc + 1];
    const hexRepr = '0x' + (opcode).toString(16).toUpperCase().padStart(4, '0');

    // Decode Opcode
    switch (opcode & 0xF000) {
      case 0x0000:
        switch (opcode & 0x000F) {
          case 0x0000: // Clears the screen.
            break;

          case 0x000E: // Returns from a subroutine.
            break;

          default:
            console.log(`Unknown opcode [0x0000]: ${ hexRepr }`);
            process.exit();
        }
        break;
      
      /*
      case 0x1000: // Jumps to address NNN.
        break;

      case 0x2000: // Calls subroutine at NNN.
        break;

      case 0x3000: // Skips the next instruction if VX equals NN. 
        break;

      case 0x4000: // Skips the next instruction if VX doesn't equal NN.
        break;

      case 0x5000: // Skips the next instruction if VX equals VY.
        break;
      */
      case 0x6000: // Sets 0x0F00 to 0x00FF.
        this.V[(opcode & 0xF00) >> 8] = opcode & 0x0FF;
        this.pc += 2;

        console.log(`[${ hexRepr }] Set V${ (opcode & 0xF00) >> 8 } to ${ opcode & 0x0FF }`);
        break;

      case 0x7000: // Adds NN to VX. (Carry flag is not changed)
        this.V[(opcode & 0xF00) >> 8] += opcode & 0x0FF;
        this.pc += 2;

        console.log(`[${hexRepr}] Add ${ opcode & 0x0FF } to V${ (opcode & 0xF00) >> 8 }`);
        break;
      /*
      case 0x8000: // Arithmetic
        break;

      case 0x9000: // Skips the next instruction if VX doesn't equal VY.
        break;
      */
      case 0xA000: // Sets I to the address NNN.
        this.I = opcode & 0xFFF;
        this.pc += 2;

        console.log(`[${hexRepr} Set I to ${ opcode & 0xFFF }`);
        break;
      /*
      case 0xB000: // Jumps to the address NNN plus V0.
        break;

      case 0xC000: // Sets VX to the result of a bitwise and operation on a random number.
        break;

      case 0xD000: // Draws a sprite at coordinate (VX, VY)
        break;
        
      case 0xE000:
        break;

      case 0xF000:
        break;
      */

      default:
        console.log(`Unknown opcode: ${ hexRepr }`);
        process.exit();
    }

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
