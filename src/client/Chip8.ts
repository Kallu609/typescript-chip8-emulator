const FONTSET = [
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

class Chip8 {
  memory: Uint8Array;     // 4096 bytes of memory
  pc: number;             // Program counter. Starts at 0x200
  V: Uint8Array;          // Registers V0 -> VF
  I: number;              // 16-bit register
  stack: Array<number>;   // Stack, 16 levels
  sp: number;             // Stack pointer
  
  delayTimer: number;     // Both 60Hz, counting to 0
  soundTimer: number;

  gfx: Array<number>;     // 64x32 display
  drawFlag: boolean;      // Should screen be redrawn
  keys: Array<number>;    // Nibble per key 0x0 - 0xF
  frequency: number;      // Hz, original: 60Hz

  constructor() {
    this.initialize();
    this.loadRom('PONG');
    // this.emulationLoop();
  }

  initialize(): void {
    this.memory = new Uint8Array(4096);
    this.pc = 0x200;
    this.V = new Uint8Array(16);
    this.I = 0;
    this.stack = Array(16).fill(0);
    this.sp = 0;

    this.delayTimer = 0;
    this.soundTimer = 0;
    
    this.gfx = new Array(2048).fill(0);
    this.frequency = 60;
    this.keys = new Array(16).fill(0);

    this.loadFontset();
  }

  log(opcode: number, text: string): void {
    const hexRepr = '0x' + (opcode).toString(16).toUpperCase().padStart(4, '0');
    console.log(`${hexRepr}   ${text}`);
  }
  
  loadFontset(): void {
    // Fontset starts from 0x00 (?)
    FONTSET.forEach((byte, i) => {
      this.memory[i] = byte;
    });
  }

  loadRom(romName: string): void {
    window.fetch('roms/PONG')
      .then(res => res.arrayBuffer())
      .then(res => {
        console.log(`ROM Size: ${ res.byteLength } bytes`);
        console.log(res);

        for (let i = 0; i < res.byteLength; i++) {
          this.memory[i + 512] = res[i];
        }
      });
  }

  emulationLoop(): void {
    const start = +new Date();
    this.emulateCycle();
    const now = +new Date();
    const deltaTime = now - start;

    const nextCycle = 1000 / this.frequency - (deltaTime);

    setTimeout(() => {
      this.emulationLoop();
    }, nextCycle);
  }

  emulateCycle(): void {
    // Fetch Opcode
    const opcode = this.memory[this.pc] << 8  | this.memory[this.pc + 1];
    
    // Decode & execute Opcode
    switch (opcode & 0xF000) {
      case 0x0000:
        switch (opcode & 0x00FF) {
          case 0x00E0: // Clears the screen.
            this.log(opcode, `Clear the screen`);
            break;

          case 0x00EE: // Returns from a subroutine
            this.sp--;
            this.pc = this.stack[this.sp];
            this.pc += 2;
            
            this.log(opcode, `Return from subroutine (sp: ${this.sp})\n`);
            break;

          default:
            this.log(opcode, 'Unknown opcode');
            process.exit();
        }
        break;
      
      case 0x1000: // Jumps to address NNN.
        this.pc = opcode & 0x0FFF;
        
        this.log(opcode, `Goto 0x0${ opcode & 0x0FFF }`);
        break;
        
      case 0x2000: { // Calls subroutine at NNN.
        const nnn = opcode & 0x0FFF;
        this.stack[this.sp] = this.pc;
        this.sp++;
        this.pc = nnn;
        
        const callAddress = `0x${ nnn.toString(16).toUpperCase().padStart(4, '0') }`;
        this.log(opcode, `Subroutine call to ${callAddress} (sp: ${this.sp})\n`);
      } break;
      
      case 0x3000: { // Skips the next instruction if VX equals NN.
        const x = (opcode & 0x0F00) >> 8;
        const nn = (opcode & 0x00FF);

        if (this.V[x] === nn) {
          this.pc += 4;
        } else {
          this.pc += 2;
        }

        this.log(opcode, `Skip if V${x} == ${nn}`);
      } break;
      
      case 0x4000: { // Skips the next instruction if VX doesn't equal NN.
        const x = (opcode & 0x0F00) >> 8;
        const nn = (opcode & 0x00FF);

        if (this.V[x] !== nn) {
          this.pc += 4;
        } else {
          this.pc += 2;
        }

        this.log(opcode, `Skip if V${(opcode & 0x0F00) >> 8} != ${ (opcode & 0x00FF) }`);
      } break;
      
      case 0x5000: { // Skips the next instruction if VX equals VY.
        const x = (opcode & 0x0F00 >> 8);
        const y = (opcode & 0x00F0 >> 4);
        const equal = this.V[x] === this.V[y];

        if (equal) {
          this.pc += 4;
        } else {
          this.pc += 2;
        }
        
        this.log(opcode, `if(X==Y) -> ${equal}`);
      } break;
      
      case 0x6000: { // Sets VX to NN.
        const x = (opcode & 0x0F00) >> 8;
        const nn = opcode & 0x00FF;

        this.V[x] = nn;
        this.pc += 2;

        this.log(opcode, `Set V${x} to ${nn}`);
      } break;

      case 0x7000: { // Adds NN to VX. (Carry flag is not changed)
        const x = (opcode & 0x0F00) >> 8;
        const nn = opcode & 0x00FF;

        this.V[x] += nn;
        this.pc += 2;

        this.log(opcode, `Add ${ nn } to V${x}`);
      } break;
      
      case 0x8000: { // Arithmetic
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;

        switch (opcode & 0x000F) {
          case 0x0000: // Sets VX to the value of VY.
            this.V[x] = this.V[y];
            this.pc += 2;

            this.log(opcode, `Set V${x} to V${y}`);
            break;

          case 0x0001: // Sets VX to VX or VY. (Bitwise OR operation)
            this.V[x] = this.V[x] | this.V[y];
            this.pc += 2;

            this.log(opcode, `Set V${x} to V${x} | V${y}`);
            break;

          case 0x0002: // Sets VX to VX and VY. (Bitwise AND operation)
            this.V[x] = this.V[x] & this.V[y];
            this.pc += 2;

            this.log(opcode, `Set V${x} to V${x} & V${y}`);
            break;

          case 0x0003: // Sets VX to VX xor VY.
            this.V[x] = this.V[x] ^ this.V[y];
            this.pc += 2;

            this.log(opcode, `Set V${x} to V${x} ^ V${y}`);
            break;

          case 0x0004: // Adds VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't.
            this.V[0xF] = Number((this.V[x] += this.V[y]) > 255);
            this.pc += 2;

            this.log(opcode, `Add V${y} to V${x}`);
            break;

          case 0x0005: // VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
            this.V[0xF] = Number((this.V[x] -= this.V[y]) < 0);
            this.pc += 2;

            this.log(opcode, `Substract V${y} to V${x}`);
            break;

          case 0x0006: // Shifts VY right by one and stores the result to VX (VY remains unchanged).
                         // VF is set to the value of the least significant bit of VY before the shift.
                         // (On some modern interpreters, VX is shifted instead, while VY is ignored.)
            this.V[0xF] = (this.V[y] & 0x1);
            this.V[x] = (this.V[y] >> 1);
            this.pc += 2;
            
            this.log(opcode, `V${x} to V${y} >> 1`);
            break;
            
          case 0x0007: // Sets VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
            this.V[0xF] = Number((this.V[x] -= (this.V[y]) - this.V[x]) < 0);
            this.pc += 2;

            this.log(opcode, `V${x} to V${x} - V${y}`);
            break;
          
          case 0x000E: // Shifts VY left by one and copies the result to VX.
                       // VF is set to the value of the most significant bit of VY before the shift
            this.V[0xF] = (this.V[y]) >> 7;
            this.V[y] = this.V[y] << 1;
            this.V[x] = this.V[y];
            this.pc += 2;
            
            this.log(opcode, `V${x} to V${y} = V${y} << 1`);
            break;

          default:
            this.log(opcode, 'Unknown opcode');
            process.exit();
        }
      } break;
      
      case 0x9000: { // Skips the next instruction if VX doesn't equal VY.
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0 >> 4);

        if (this.V[x] !== this.V[y]) {
          this.pc += 4;
        } else {
          this.pc += 2;
        }

        this.log(opcode, `Skip next if V${x} (${ this.V[y] }) is not V${x} (${ this.V[y] })`);
      } break;
        
      case 0xA000: { // Sets I to the address NNN.
        const nnn = opcode & 0xFFF;

        this.I = nnn;
        this.pc += 2;

        this.log(opcode, `Set I to ${nnn}`);
      } break;

      case 0xB000: { // Jumps to the address NNN plus V0.
        const nnn = opcode & 0xFFF;
        this.pc = this.V[0] + nnn;
          
        this.log(opcode, `Goto V0 + 0x0${nnn} => ${ this.V[0] + nnn }`);
      } break;

      case 0xC000: { // Sets VX to the result of a bitwise and operation on a random number.
        const x = (opcode & 0x0F00) >> 8 ;
        const nn = (opcode & 0x00FF);
        const random = Math.floor(Math.random() * 256);

        this.V[x] = (random & nn);
        this.pc += 2;

        this.log(opcode, `Random to V${x}: ${ random & nn }`);
      } break;
      
      case 0xD000: { // Draws a sprite at coordinate (VX, VY)
        const x = (opcode & 0x0F00) >> 8;
        const y = (opcode & 0x00F0) >> 4;
        const height = opcode & 0x000F;
        
        this.V[0xF] = 0; // VF is set to 1 if any screen pixels are flipped from set to unset 
        
        for (let yline = 0; yline < height; yline++) {
          const pixel = this.memory[this.I + yline];
          
          for (let xline = 0; xline < 8; xline++) {
            if ((pixel & (0x80 >> xline)) !== 0) {
              const bit = (x + xline + (( y + yline) * 64));

              if (this.gfx[bit] === 1) {
                this.V[0xF] = 1;
              }

              this.gfx[bit] = this.gfx[bit] ^ 1;
            }
          }
        }
        
        this.drawFlag = true;
        this.pc += 2;
        
        this.log(opcode, `Drawing sprite to (V${x}: ${ this.V[x] }, ` + 
                     `V${y}: ${ this.V[y] }) with height of ${ height }`);
      } break;

      case 0xE000: {
        const x = (opcode & 0x0F00) >> 8;

        switch (opcode & 0x00FF) {
          case 0x009E: // Skips the next instruction if the key stored in VX is pressed.
            if (this.keys[x] === 1) {
              this.pc += 4;
            } else {
              this.pc += 2;
            }

            this.log(opcode, `Skip next if keys[${x}] (Pressed: ${ this.keys[x] === 1 }) is pressed.`);
            break;

          case 0x00A1: // Skips the next instruction if the key stored in VX isn't pressed.
            if (this.keys[x] === 0) {
              this.pc += 4;
            } else {
              this.pc += 2;
            }

            this.log(opcode, `Skip next if keys[${x}] (Pressed: ${ this.keys[x] === 0 }) is not pressed.`);
            break;

          default:
            this.log(opcode, 'Unknown opcode');
            process.exit();
        }
      } break;

      case 0xF000: {
        const x = (opcode & 0x0F00) >> 8;

        switch (opcode & 0x00FF) {  
          case 0x0007: // Sets Vx to the value of the delay timer
            this.V[x] = this.delayTimer;
            this.pc += 2;
            
            this.log(opcode, `Set V${ x.toString(16) } to value of the delay timer`);
            break;
            
          case 0x0015: // Sets the delay timer to VX.
            this.delayTimer = opcode & 0x0F00 >> 8;
            this.pc += 2;
            
            this.log(opcode, `Set delay timer to: ${ x }`);
            break;
          
          case 0x0018: // Sets the sound timer to VX.
            this.soundTimer = opcode & 0x0F00 >> 8;
            this.pc += 2;
            
            this.log(opcode, `Set sound timer to: ${ x }`);
            break;
          
          case 0x001E: // Adds VX to I.
            this.I += this.V[x];
            this.pc += 2;

            this.log(opcode, `Add V${ x } to I`);
            break;

          case 0x0029: // Sets I to the location of the sprite for the character in VX.
            this.I = x * 5;
            this.pc += 2;
            
            this.log(opcode, `Set I to location of character sprite: ${x * 5}`);
            break;
          
          case 0x0033: // Stores the binary-coded decimal representation of VX,
                       // with the most significant of three digits at the address in I,
                       // the middle digit at I plus 1, and the least significant digit at I plus 2.
                       // AKA: wat
            this.memory[this.I] = this.V[x] / 100;
            this.memory[this.I + 1] = (this.V[x] / 10) % 10;
            this.memory[this.I + 2] = (this.V[x] % 100) % 10;
            this.pc += 2;
            
            this.log(opcode, 
              `I: ${ this.V[x] / 100 }, ` + 
              `I + 1: ${ (this.V[x] / 10) % 10 }, ` + 
              `I + 2: ${ (this.V[x] % 100) % 10 }`
            );
            break;
            
          case 0x0055: // Stores V0 to VX in memory starting at address I.
            for (let i = 0; i <= x; i++) {
              this.memory[this.I + i] = this.V[i];
            }
            
            this.I += x + 1;
            this.pc += 2;
            
            this.log(opcode, `Dump registers`);
            break;
            
          case 0x0065: // Fills V0 to VX with values from memory starting at address I.
            for (let i = 0; i <= x; i++) {
              this.V[i] = this.memory[this.I + i];
            }
            
            this.I += (x) + 1;
            this.pc += 2;
 
            this.log(opcode, `Load registers V0 to V${x}`);
            break;
            
          default:
            this.log(opcode, 'Unknown opcode');
            process.exit();
        }
      } break;

      default:
        this.log(opcode, 'Unknown opcode');
        process.exit();
    }

    // Update timers
    if (this.delayTimer > 0) {
      this.delayTimer--;
    }

    if (this.soundTimer > 0) {
      this.soundTimer--;
    }
  }
}

export default Chip8;
