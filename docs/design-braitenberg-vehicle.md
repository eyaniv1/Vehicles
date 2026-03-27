# Braitenberg Vehicle — Design Document

**Date:** 2026-03-27
**Version:** 1.1 (added simulation insights)

## Overview

A single reconfigurable physical vehicle that can behave as any of Braitenberg's
Vehicles 1, 2a, 2b, 3a, or 3b via three physical toggle switches. Built as a
low-cost educational toy for children aged 6+, with a path to software-based
configuration (web UI), advanced behaviors (gas tank, multi-vehicle interaction),
and additional sensor types.

---

## Vehicle Behaviors

| Switch Config | Vehicle | Name | Behavior |
|---------------|---------|------|----------|
| 1 sensor / any / excitatory | **V1** | Getting Around | Speeds up near light, slows in dark. Aimless wanderer. |
| 2 sensors / uncrossed / excitatory | **V2a** | Fear | Turns away from light, accelerates. Coward. |
| 2 sensors / crossed / excitatory | **V2b** | Aggression | Turns toward light, accelerates. Charges at sources. |
| 2 sensors / uncrossed / inhibitory | **V3a** | Love | Approaches light, slows to rest facing it. Devoted. |
| 2 sensors / crossed / inhibitory | **V3b** | Explorer | Approaches light, slows to rest near it, facing slightly away. |

---

## Bill of Materials

| # | Part | Description | Source | Cost |
|---|------|-------------|--------|------|
| 1 | ESP32 Basic Starter Kit | ESP32 38-pin dev board, expansion board, 830-hole breadboard, USB cable, 65 jumper wires, 40 Dupont cables (M-F and F-F), 10KΩ resistors (x10), 1x LDR photoresistor, OLED 0.96", DHT11 temp/humidity sensor, IR sensor, PIR motion sensor, LEDs, buzzers, buttons, resistor assortment | Piitel | ₪175 |
| 2 | MTS-103 Toggle Switches x3 | 3-Pin 6A 125VAC Miniature SPDT, ON-OFF-ON | See-Sys | ₪27 (₪9 each) |
| 3 | VBOTCOR 2WD Robot Car Chassis Kit | Acrylic chassis, 2x DC geared TT motors (1:48), 2 wheels, caster, 4xAA battery box, L298N motor driver, screws, screwdriver | Amazon | ~₪30 (~$8) |
| 4 | 1x LDR Photoresistor GL5528 | Second light sensor (kit includes only 1, need 2) | TBD | ~₪2-5 |
| 5 | 4x AA Batteries | Power supply (6V) | The shop next door | ~₪5 |
| **Total** | | | | **~₪240** |

**Note:** The Piitel ESP32 kit is the largest expense but includes many components
needed for future expansion phases (DHT11 for temperature stimulus, IR sensor
for vehicle-to-vehicle sensing, OLED for displaying vehicle state, LEDs for
making the vehicle visible to others).

---

## Power Design

**Source:** 4x AA batteries = 6V

**Distribution:**
- 6V → L298N motor power input (12V pin, regulator jumper ON)
- 6V → ESP32 Vin pin (onboard AMS1117 regulates to 3.3V)
- L298N logic: powered from its own onboard 5V regulator (~4.3V output with 6V input — adequate)

**Notes:**
- L298N has ~2V voltage drop across the H-bridge, so motors receive ~4V. This is within the TT motor operating range (3-6V).
- When batteries drop below ~5V, motor performance will degrade. Replace batteries.
- No charging circuit needed. Kid-safe, simple swap.

---

## Wiring Diagram

### ESP32 Pin Assignments

```
ESP32 Pin       Connected To           Purpose
---------       ------------           -------
GPIO 34         Left LDR divider       Analog input (left eye)
GPIO 35         Right LDR divider      Analog input (right eye)

GPIO 25         Switch 1 center pin    Digital input: 1-sensor / 2-sensor
GPIO 26         Switch 2 center pin    Digital input: uncrossed / crossed
GPIO 27         Switch 3 center pin    Digital input: excitatory / inhibitory

GPIO 32         L298N ENA              PWM: left motor speed
GPIO 33         L298N IN1              Digital: left motor direction
GPIO 14         L298N IN2              Digital: left motor direction

GPIO 15         L298N ENB              PWM: right motor speed
GPIO 16         L298N IN3              Digital: right motor direction
GPIO 17         L298N IN4              Digital: right motor direction

Vin             Battery 6V (+)         Power input
GND             Battery GND (-)        Common ground
```

### LDR Circuits (x2, identical)

Each LDR forms a voltage divider with a 10k resistor:

```
    3.3V
     |
    [LDR]
     |
     +------> GPIO 34 (or 35)
     |
   [10k]
     |
    GND
```

- Bright light → LDR resistance drops → voltage at GPIO rises → high reading
- Dark → LDR resistance rises → voltage at GPIO drops → low reading
- ESP32 ADC reads 0-4095 (12-bit)

### Toggle Switches

Each switch has 3 pins. Center pin goes to the ESP32 GPIO. The two outer pins
go to 3.3V and GND respectively. Internal pull-up/pull-down is not needed since
both positions connect to a defined voltage.

```
    3.3V ---- [Pin 1]
                          \
               [Pin 2 (center)] ----> GPIO 25 (or 26, or 27)
                          /
    GND  ---- [Pin 3]
```

- Switch flipped one way → GPIO reads HIGH
- Switch flipped other way → GPIO reads LOW
- Center position (if ON-OFF-ON type) → floating, read as default

**Switch mapping:**

| Switch | GPIO | HIGH = | LOW = |
|--------|------|--------|-------|
| SW1 (sensor count) | 25 | 2 sensors | 1 sensor |
| SW2 (wiring) | 26 | Crossed | Uncrossed |
| SW3 (polarity) | 27 | Inhibitory | Excitatory |

### L298N Motor Driver Connections

```
L298N Pin       Connected To
---------       ------------
12V (Vin)       Battery 6V (+)
GND             Battery GND (-) and ESP32 GND (common ground!)
5V              (output, not used — ESP32 powered from battery via Vin)

ENA             ESP32 GPIO 32 (PWM)
IN1             ESP32 GPIO 33
IN2             ESP32 GPIO 14
ENB             ESP32 GPIO 15 (PWM)
IN3             ESP32 GPIO 16
IN4             ESP32 GPIO 17

OUT1            Left motor wire 1
OUT2            Left motor wire 2
OUT3            Right motor wire 1
OUT4            Right motor wire 2
```

### Full Wiring Overview

```
                    [LEFT LDR]  [RIGHT LDR]
                        |            |
                     voltage      voltage
                     divider      divider
                        |            |
  [SW1]--GPIO 25    GPIO 34      GPIO 35
  [SW2]--GPIO 26
  [SW3]--GPIO 27
                   +-----------+
                   |           |
                   |   ESP32   |
                   |  DevKit   |
                   |           |
                   +-----------+
                    |  |  |  |  |  |
               GPIO: 32 33 14 15 16 17
                    |  |  |  |  |  |
               +----+--+--+--+--+----+
               |                     |
               |       L298N         |
               |                     |
               +----+----------+-----+
                    |          |
              [LEFT MOTOR] [RIGHT MOTOR]
                    |          |
              [LEFT WHEEL] [RIGHT WHEEL]

                  [4xAA BATTERY]
                   + 6V    GND
                   |        |
              to L298N 12V  to common GND
              to ESP32 Vin
```

---

## Firmware Design

### Core Logic

The firmware is elegant in its simplicity. The entire behavioral difference
between all 5 vehicles comes down to 3 decisions applied to sensor readings:

```
1. COMBINE or SEPARATE the two sensor readings
2. SWAP or DON'T SWAP left/right (crossed vs uncrossed)
3. INVERT or DON'T INVERT the speed mapping (inhibitory vs excitatory)
```

### Pseudocode

```
CONSTANTS:
  BASE_SPEED = 128          // base motor speed for inhibitory mode (out of 255)
  MIN_SPEED  = 0            // motor off
  MAX_SPEED  = 255          // full speed

SETUP:
  Configure GPIO 34, 35 as analog inputs (LDRs)
  Configure GPIO 25, 26, 27 as digital inputs (switches)
  Configure GPIO 32, 15 as PWM outputs (motor enable)
  Configure GPIO 33, 14, 16, 17 as digital outputs (motor direction)
  Set motor direction to FORWARD on both motors:
    IN1=HIGH, IN2=LOW   (left motor forward)
    IN3=HIGH, IN4=LOW   (right motor forward)

LOOP (every 50ms):
  // 1. Read sensors
  raw_left  = analogRead(GPIO_34)    // 0-4095
  raw_right = analogRead(GPIO_35)    // 0-4095

  // 2. Read switches
  two_sensors = digitalRead(GPIO_25)  // HIGH=2 sensors, LOW=1 sensor
  crossed     = digitalRead(GPIO_26)  // HIGH=crossed, LOW=uncrossed
  inhibitory  = digitalRead(GPIO_27)  // HIGH=inhibitory, LOW=excitatory

  // 3. Determine sensor inputs for each motor
  IF NOT two_sensors:
    // Vehicle 1: both motors get the average
    combined = (raw_left + raw_right) / 2
    left_input  = combined
    right_input = combined
  ELSE IF crossed:
    // Vehicles 2b, 3b: swap sides
    left_input  = raw_right
    right_input = raw_left
  ELSE:
    // Vehicles 2a, 3a: same sides
    left_input  = raw_left
    right_input = raw_right

  // 4. Map sensor input to motor speed
  IF inhibitory:
    // More light = slower (Vehicles 3a, 3b)
    left_speed  = map(left_input,  0, 4095, MAX_SPEED, MIN_SPEED)
    right_speed = map(right_input, 0, 4095, MAX_SPEED, MIN_SPEED)
  ELSE:
    // More light = faster (Vehicles 1, 2a, 2b)
    left_speed  = map(left_input,  0, 4095, MIN_SPEED, MAX_SPEED)
    right_speed = map(right_input, 0, 4095, MIN_SPEED, MAX_SPEED)

  // 5. Drive motors
  analogWrite(ENA, left_speed)
  analogWrite(ENB, right_speed)
```

### Notes on the Firmware

- **Motors always go forward.** Braitenberg vehicles never reverse. Direction pins
  are set once in setup and never change. Only speed varies.
- **The loop runs every 50ms** (20Hz). Fast enough for responsive behavior,
  slow enough to be stable.
- **ADC smoothing:** In practice, add a simple rolling average (last 4-8 readings)
  to avoid jittery motor response from noisy ADC readings.
- **Dead zone:** Motors may not spin below a certain PWM value (~50-80 out of
  255 depending on the motor). Add a threshold: if speed < MIN_THRESHOLD,
  set to 0; otherwise remap from MIN_THRESHOLD to MAX_SPEED.

---

## Physical Assembly

### Chassis Layout (Top View)

```
          FRONT (sensor end)
    +---------------------------+
    |                           |
    |   [LDR-L]       [LDR-R]  |   <- mounted on front edge, facing forward
    |                           |
    |   [SW1] [SW2] [SW3]      |   <- accessible on top plate
    |                           |
    |   +---[BREADBOARD]---+    |   <- ESP32 + wiring on upper plate
    |   |    [ESP32]       |    |
    |   +------------------+    |
    |                           |
    |       [L298N]             |   <- on lower plate
    |                           |
    [M-L]     [CASTER]    [M-R]    <- motors on sides, caster at rear
    +---------------------------+
              REAR
```

### Assembly Steps

1. Assemble VBOTCOR chassis per included instructions (lower plate, motors, wheels, caster)
2. Mount L298N on lower plate using standoffs or screws
3. Mount battery box on lower plate (usually clips underneath)
4. Attach upper plate with standoffs
5. Stick mini breadboard on upper plate (adhesive back)
6. Insert ESP32 into breadboard
7. Mount 3 toggle switches through holes drilled in upper plate (or hot-glue to edge)
8. Mount 2 LDRs on front edge of upper plate, pointing forward, spaced ~5-8cm apart
9. Wire everything per the wiring diagram above

### Sensor Mounting

The LDRs should be:
- **Facing forward** (same direction the vehicle drives)
- **Spaced apart** (wider = more directional sensitivity = more dramatic turning)
- **Optionally shielded** with small tubes (toilet paper roll cut to ~2cm) to make them more directional — this dramatically improves steering behavior

---

## Configuration Labels

For young children, label the switches on the chassis:

```
SW1:  [ONE EYE  |  TWO EYES]
SW2:  [STRAIGHT |  CRISS-CROSS]
SW3:  [SPEED UP |  SLOW DOWN]
```

And provide a simple card:

```
SCARED ROBOT:     Two Eyes + Straight + Speed Up    → Runs from light!
ANGRY ROBOT:      Two Eyes + Criss-Cross + Speed Up → Charges at light!
LOVING ROBOT:     Two Eyes + Straight + Slow Down   → Cuddles the light!
CURIOUS ROBOT:    Two Eyes + Criss-Cross + Slow Down→ Explores near light!
SIMPLE ROBOT:     One Eye  + (any) + Speed Up       → Wanders around!
```

---

## Simulation Insights

A 2D simulator (`simulation/index.html`) was built to validate all 5 vehicle
behaviors before hardware construction. The following insights emerged and should
guide the firmware implementation.

### Sensor Directionality Is Critical

Omnidirectional sensors work fine for V1, V2a, and V2b. However, **V3a vs V3b
cannot be distinguished without directional sensors.** When close to the light
source, omnidirectional sensors saturate — both read ~1.0 regardless of the
vehicle's orientation. This eliminates the left/right differential that V3b
needs to settle facing away from the light.

**Solution — physical sensor shielding:**
Mount each LDR inside a short tube (e.g., toilet paper roll cut to ~2cm). This
restricts each sensor's field of view so it primarily "sees" light on its own
side. The simulation models this as a directional bias:

- Each sensor's facing direction = vehicle forward + slight bias toward its own side
- Cosine of angle between sensor direction and light direction drives a
  directional factor (0.2 to 1.0)
- Light from behind still registers at ~20% (light leaks around tube)

**This is the single most important hardware detail.** Without tube shields,
V3b will behave identically to V3a. With them, V3b reliably settles near the
light facing slightly away — the "Explorer" behavior.

### Speed-to-Motor Mapping

The simulation revealed that a simple linear mapping (sensor → motor speed)
produces weak, hard-to-distinguish behaviors. Key findings:

**Excitatory mode (V1, V2a, V2b):**
- Needs a small base speed (~15% of max) so the vehicle wanders even in darkness
- Without this, the vehicle sits dead until light appears
- Firmware: `speed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * sensorInput`

**Inhibitory mode (V3a, V3b):**
- Must allow motors to reach **zero speed** (full stop) when sensor reads max
- Any non-zero base speed prevents the vehicle from resting near the light
- Firmware: `speed = MAX_SPEED * (1 - sensorInput)`

### Speed Contrast Curve

A power-law curve applied to the speed values dramatically improves behavior
visibility. The exponent controls how much the speed difference between
"seeing light" and "not seeing light" is amplified:

```
final_speed = pow(mapped_speed, exponent) * MAX_PWM

exponent = 1.0  →  linear (gentle, subtle differences)
exponent = 2.0  →  quadratic (good default, clear behavioral differences)
exponent = 3.0  →  cubic (extreme, very dramatic contrast)
```

**Recommendation:** Start with exponent = 2.0 in firmware. Expose this as a
tunable parameter in the Phase 2 web UI ("Speed Contrast" slider).

### Updated Firmware Pseudocode

The original pseudocode should be revised to incorporate these findings:

```
CONSTANTS:
  BASE_SPEED     = 40           // ~15% of 255, keeps vehicle moving in dark
  MOTOR_MIN_PWM  = 50           // below this, TT motors stall — treat as 0
  MAX_SPEED      = 255
  SPEED_EXPONENT = 2.0          // power-law curve (tunable via web UI later)

// ... (setup and sensor/switch reading unchanged) ...

// 4. Map sensor input to motor speed
IF inhibitory:
  // More light = slower, CAN REACH ZERO
  left_speed  = (1.0 - left_input / 4095.0)
  right_speed = (1.0 - right_input / 4095.0)
ELSE:
  // More light = faster, with base speed for wandering
  base = BASE_SPEED / 255.0     // ~0.15
  left_speed  = base + (1.0 - base) * (left_input / 4095.0)
  right_speed = base + (1.0 - base) * (right_input / 4095.0)

// 5. Apply speed contrast curve
left_speed  = pow(left_speed, SPEED_EXPONENT)
right_speed = pow(right_speed, SPEED_EXPONENT)

// 6. Convert to PWM with dead zone
left_pwm  = left_speed * MAX_SPEED
right_pwm = right_speed * MAX_SPEED
IF left_pwm < MOTOR_MIN_PWM AND left_pwm > 0:  left_pwm = 0
IF right_pwm < MOTOR_MIN_PWM AND right_pwm > 0: right_pwm = 0

analogWrite(ENA, left_pwm)
analogWrite(ENB, right_pwm)
```

### Parameters to Expose in Web UI (Phase 2)

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| Speed Contrast (exponent) | 2.0 | 1.0–3.0 | Amplifies speed differences between light/dark |
| Base Speed | 40 | 0–80 | Minimum motor speed in dark (excitatory mode only) |
| Motor Dead Zone | 50 | 30–80 | PWM threshold below which motors stall |
| Light Intensity Scale | — | — | Adjust sensitivity to ambient light conditions |

### Light Source Considerations

- **Inverse square law** governs intensity falloff — behavior changes dramatically
  with distance. A flashlight 10cm away vs 50cm away is a 25x intensity difference.
- **Ambient light** will add a constant offset to both sensors. The firmware
  should either calibrate on startup (read ambient, subtract as baseline) or
  let the user calibrate via a button press.
- **Intensity of the light source matters.** A desk lamp vs a flashlight will
  produce very different response ranges. The web UI should allow sensitivity
  adjustment.

### Simulation as a Development Tool

The simulator at `simulation/index.html` can be used to:
1. **Validate firmware logic** before uploading — the simulation physics match
   the firmware pseudocode
2. **Demonstrate behaviors** to kids before building — no hardware needed
3. **Tune parameters** (speed contrast, sensor directionality) before committing
   to physical sensor mounting
4. **Debug** unexpected physical behavior by comparing to simulation predictions

---

## Future Expansion Path

### Phase 2: Web UI Configuration
- ESP32 hosts a WiFi access point and serves a web page
- Kids connect phone/tablet to vehicle WiFi, open browser
- Visual interface: drag wiring connections, adjust response curves
- Enables non-linear response functions (threshold, sigmoid, exponential)
- No code required

### Phase 3: Gas Tank Behavior
- Software-only feature (no hardware changes)
- Variable `energy_tank` charges when light sensor reads high
- `energy_tank` drains proportional to motor speed
- When tank drops below threshold, vehicle switches to "seek light" behavior (V3a)
- When tank is full, switches to configured behavior (V2a, V2b, etc.)
- Creates autonomous foraging behavior

### Phase 4: Additional Sensors
- Temperature (thermistor) — same voltage-divider circuit as LDR
- Sound (electret microphone + amplifier module)
- Proximity (HC-SR04 ultrasonic or IR distance sensor)
- Each sensor pair adds to the front of the chassis
- Web UI allows mapping any sensor to any motor with any polarity

### Phase 5: Multi-Vehicle Interaction
- ESP32 WiFi/Bluetooth enables vehicle-to-vehicle communication
- Vehicles can broadcast their position/state
- One vehicle's "light" can be another vehicle's stimulus
- Emergent swarm behaviors from simple individual rules
- IR LEDs on vehicles could act as light sources for other vehicles' LDRs

---

## Testing Procedure

1. **Power test:** Insert batteries, verify ESP32 powers on (onboard LED)
2. **Sensor test:** Cover each LDR, verify ADC reading changes (serial monitor)
3. **Switch test:** Flip each switch, verify GPIO reads change (serial monitor)
4. **Motor test:** Manually set each motor to 50% speed, verify wheels spin forward
5. **Integration test per vehicle:**
   - V1: Shine flashlight → vehicle speeds up. Block light → slows down.
   - V2a: Shine flashlight from left → vehicle turns right (away). Confirm fear.
   - V2b: Shine flashlight from left → vehicle turns left (toward). Confirm aggression.
   - V3a: Shine flashlight → vehicle approaches, slows, stops near light. Confirm love.
   - V3b: Shine flashlight → vehicle approaches, slows, stops slightly past light. Confirm explorer.

---

## Reference

- Braitenberg, V. (1984). *Vehicles: Experiments in Synthetic Psychology*. MIT Press.
- Vehicles 1-3, pages 3-14.
- 2D Simulator: `simulation/index.html` — interactive browser-based simulation of all 5 vehicle behaviors
