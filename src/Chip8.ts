import * as fs from 'fs';
import * as path from 'path';
import { arrChunk } from './lib/helpers';

const ROM_DIR = path.join(__dirname, 'roms');
const MEMORY_DUMP_PATH = path.join(__dirname, 'memorydump.hex');

class Chip8 {
  memory: Uint8Array;     // CHIP-8 memory
  pc: number;             // Program counter
  V: Uint8Array;          // Registers V0 -> VF
  I: number;              // 16-bit register
  stack: Array<number>;      // Stack, 16 levels
  sp: number;             // Stack pointer
  
  delayTimer: number;     // Both 60Hz, counting to 0
  soundTimer: number;

  gfx: Array<number>;     // 64x32 display
  drawFlag: boolean;        // Should screen be redrawn
  
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
    this.stack = Array(16).fill(0);
    this.sp = 0;
    
    this.delayTimer = 0;
    this.soundTimer = 0;
    
    this.gfx = new Array(2048).fill(0);

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
    fontset.forEach((byte, i) => {
      this.memory[i] = byte;
    });
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
        switch (opcode & 0x00FF) {
          case 0x00E0: // Clears the screen.
            console.log(`[${hexRepr}] Clear the screen`);
            break;

          case 0x00EE: // Returns from a subroutine
            this.sp--;
            this.pc = this.stack[this.sp];
            this.pc += 2;
            
            console.log(`[${hexRepr}] Return from subroutine (sp: ${this.sp})\n`);
            break;

          default:
            console.log(`Unknown opcode [0x0000]: ${ hexRepr }`);
            process.exit();
        }
        break;
      
      case 0x1000: // Jumps to address NNN.
        this.pc = opcode & 0x0FFF;
        
        console.log(`[${hexRepr}] Goto 0x0${ opcode & 0x0FFF }`);
        break;
        
      case 0x2000: // Calls subroutine at NNN.
        this.stack[this.sp] = this.pc;
        this.sp++;
        this.pc = opcode & 0x0FFF;
        
        const callAddress = `0x${ (opcode & 0x0FFF).toString(16).toUpperCase().padStart(4, '0') }`;
        console.log(`[${hexRepr}] Subroutine call to ${callAddress} (sp: ${this.sp})\n`);
        break;
      /*
      case 0x3000: // Skips the next instruction if VX equals NN. 
        break;

      case 0x4000: // Skips the next instruction if VX doesn't equal NN.
        break;
      */
      case 0x5000: // Skips the next instruction if VX equals VY.
        const equal = (opcode & 0x0F00 >> 8) === (opcode & 0x00F0 >> 4);
        if (equal) {
          this.pc += 4;
        } else {
          this.pc += 2;
        }
        
        console.log(`[${hexRepr}] if(X==Y) -> ${equal}`);
        break;
      
      case 0x6000: // Sets 0x0F00 to 0x00FF.
        this.V[(opcode & 0x0F00) >> 8] = opcode & 0x00FF;
        this.pc += 2;

        console.log(`[${ hexRepr }] Set V${ (opcode & 0x0F00) >> 8 } to ${ opcode & 0x00FF }`);
        break;

      case 0x7000: // Adds NN to VX. (Carry flag is not changed)
        this.V[(opcode & 0x0F00) >> 8] += opcode & 0x00FF;
        this.pc += 2;

        console.log(`[${hexRepr}] Add ${ opcode & 0x00FF } to V${ (opcode & 0x0F00) >> 8 }`);
        break;
      /*
      case 0x8000: // Arithmetic
        break;

      case 0x9000: // Skips the next instruction if VX doesn't equal VY.
        break;
      */
      case 0xA000: // Sets I to the address NNN.
        this.I = opcode & 0x0FFF;
        this.pc += 2;

        console.log(`[${hexRepr}] Set I to ${ opcode & 0xFFF }`);
        break;
      /*
      case 0xB000: // Jumps to the address NNN plus V0.
        break;

      case 0xC000: // Sets VX to the result of a bitwise and operation on a random number.
        break;
      */
      case 0xD000: // Draws a sprite at coordinate (VX, VY)
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        const height = opcode & 0x000F;
        
        this.V[0xF] = 0; // VF is set to 1 if any screen pixels are flipped from set to unset 
        
        for (let yline = 0; yline < height; yline++) {
          const pixel = this.memory[this.I + yline];
          
          for (let xline = 0; xline < 8; xline++) {
            if ((pixel & (0x80 >> xline)) !== 0) {
              const bit = (x + xline + (( y + yline) * 64))

              if (this.gfx[bit] === 1) {
                this.V[0xF] = 1;
              }

              this.gfx[bit] = this.gfx[bit] ^ 1;
            }
          }
        }
        
        this.drawFlag = true;
        this.pc += 2;
        
        console.log(
          `[${hexRepr}] Drawing sprite to ` + 
          `(V${ (opcode & 0x0F00) >> 8 }: ${ this.V[(opcode & 0x0F00) >> 8] }, ` +
          `V${  (opcode & 0x00F0) >> 4 }: ${ this.V[(opcode & 0x00F0) >> 4] }) ` +
          `with height of ${ opcode & 0x000F }`);
        
        break;

      /*
      case 0xE000:
        break;
      */
      case 0xF000:
        switch (opcode & 0x00FF) {  
          case 0x0007: // Sets Vx to the value of the delay timer
            this.V[(opcode & 0x0F00) >> 8] = this.delayTimer;
            this.pc += 2;
            
            console.log(
              `[${hexRepr}] Set V${ ((opcode & 0x0F00) >> 8).toString(16) } to ` +
              `value of the delay timer`
            );
            break;
            
          case 0x0015: // Sets the delay timer to VX.
            this.delayTimer = opcode & 0x0F00 >> 8;
            this.pc += 2;
            
            console.log(`[${hexRepr}] Set delay timer to: ${ (opcode & 0x0F00) >> 8 }`);
            break;
            
          case 0x0029: // Sets I to the location of the sprite for the character in VX
            this.I = ((opcode & 0x0F00) >> 8) * 5;
            this.pc += 2;
            
            console.log(
              `[${hexRepr}] Set I to location of character sprite: ` + 
              `${ ((opcode & 0x0F00) >> 8) * 5 }`
            );
            break;
          
          case 0x0033: // Stores the binary-coded decimal representation of VX,
                       // with the most significant of three digits at the address in I,
                       // the middle digit at I plus 1, and the least significant digit at I plus 2.
                       // AKA: wat
            this.memory[this.I] = this.V[(opcode & 0x0F00) >> 8] / 100;
            this.memory[this.I + 1] = (this.V[(opcode & 0x0F00) >> 8] / 10) % 10;
            this.memory[this.I + 2] = (this.V[(opcode & 0x0F00) >> 8] % 100) % 10
            this.pc += 2;
            
            console.log(
              `[${hexRepr}] ` + 
              `I: ${ this.V[(opcode & 0x0F00) >> 8] / 100 }, ` + 
              `I+1: ${ (this.V[(opcode & 0x0F00) >> 8] / 10) % 10 }, ` + 
              `I+2: ${ (this.V[(opcode & 0x0F00) >> 8] % 100) % 10 }`
            );
            break;
            
          case 0x0055: // Stores V0 to VX in memory starting at address I
            for (let i = 0; i <= ((opcode & 0x0F00) >> 8); i++) {
              this.memory[this.I + i] = this.V[i];
            }
            
            this.I += ((opcode & 0x0F00) >> 8) + 1;
            this.pc += 2;
            
            console.log(`[${hexRepr}] Dump registers`);
            break;
            
          case 0x0065: // Fills V0 to VX with values from memory starting at address I
            for (let i = 0; i <= ((opcode & 0x0F00) >> 8); i++) {
              this.V[i] = this.memory[this.I + i];
            }
            
            this.I += ((opcode & 0x0F00) >> 8) + 1;
            this.pc += 2;
 
            console.log(`[${hexRepr}] Load registers V0 to V${ ((opcode & 0x0F00) >> 8) }`);
            break
            
          default:
            console.log(`Unknown opcode [0xF000]: ${ hexRepr }`);
            process.exit();
        }
        break;

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
    
    const chunks = arrChunk(hexBytes, 16);
    const lines = chunks.map(chunk => chunk.join(' '));

    const dumpText = lines.join('\n');
    fs.writeFileSync(MEMORY_DUMP_PATH, dumpText);
  }
}

export default Chip8;
