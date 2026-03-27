# Braitenberg Vehicles Project — Overview

**Date:** 2026-03-27

## Vision

Build a series of small physical vehicles inspired by Valentino Braitenberg's
*Vehicles: Experiments in Synthetic Psychology* (MIT Press, 1984). The vehicles
demonstrate how complex-looking behavior (fear, aggression, love, curiosity)
emerges from very simple sensor-to-motor wiring.

The project is designed as a sophisticated educational toy:
- **Age 6+:** Configure behavior by flipping physical toggle switches — no code needed
- **Age 8-10+:** Connect via browser to a web UI hosted on the vehicle itself, adjust
  response curves, enable advanced behaviors like "gas tank" energy management
- **Advanced:** Add sensors, program custom behaviors, run multiple vehicles that
  react to each other

## Design Decisions

### Single reconfigurable vehicle
Rather than building 5 separate vehicles, one chassis supports all 5 behaviors
(V1, V2a, V2b, V3a, V3b) through 3 physical toggle switches that control:
1. Number of active sensors (1 or 2)
2. Wiring topology (uncrossed or crossed)
3. Sensor polarity (excitatory or inhibitory)

### ESP32 over Arduino Nano
Chose ESP32-DevKit for the built-in WiFi/Bluetooth, which enables:
- Web UI configuration (no app install — vehicle hosts its own page)
- Vehicle-to-vehicle communication in later phases
- Cost difference is only ~₪15-20

### Physical switches + microcontroller (Option B)
Considered three approaches:
- **Option A:** Physical switches/jumpers only — tactile but no software extensibility
- **Option B (chosen):** ESP32 reads physical switches, logic in software — best of both worlds
- **Option C:** Pure analog (no microcontroller) — cheapest but no upgrade path

Option B gives kids the tangible "I changed the wiring" experience while
enabling software-based features (gas tank, web UI, multi-vehicle) later.

### Light as primary stimulus
Cheapest and most dramatic sensor type. Photoresistors cost pennies, and a
flashlight or desk lamp makes an obvious "source" for demos.

### 4xAA batteries over LiPo
Simpler, safer for kids, no charging circuit needed. The chassis kit includes
a battery holder. Can upgrade to LiPo later without changing anything else.

## Planned Phases

### Phase 1: Core Vehicle (current)
- Build chassis with 2 motors, 2 LDR sensors, 3 toggle switches
- Firmware: read switches, map sensors to motors accordingly
- All 5 Braitenberg behaviors (V1, V2a, V2b, V3a, V3b) via switches
- **Status:** Hardware being purchased. Firmware to be written when HW arrives.

### Phase 2: Web UI Configuration
- ESP32 hosts a WiFi access point and serves a web page
- Kids connect phone/tablet, configure vehicle visually
- Drag wiring connections, adjust response curves (linear, exponential, threshold)
- Soft switches in the UI replicate and extend the physical toggle switches
- No code required from the user

### Phase 3: Gas Tank Behavior
- Software-only feature (no hardware changes)
- `energy_tank` variable charges when near light, drains while driving
- Below threshold → vehicle switches to "seek light" (V3a behavior)
- Above threshold → runs configured behavior
- Creates autonomous foraging — vehicle "feeds" on light

### Phase 4: Additional Sensors
- Temperature (DHT11 — already in the Piitel kit)
- Sound, proximity (IR — already in the Piitel kit)
- Each sensor pair adds a new stimulus type
- Web UI allows mapping any sensor to any motor with any polarity
- Approaches Vehicle 3c and Vehicle 4 territory from the book

### Phase 5: Multi-Vehicle Interaction
- Multiple vehicles in the same environment
- ESP32 WiFi/Bluetooth for vehicle-to-vehicle communication
- IR LEDs on vehicles act as light sources for other vehicles' LDRs
- Emergent swarm behaviors from simple individual rules

## Documents

- [design-braitenberg-vehicle.md](design-braitenberg-vehicle.md) — Full technical design: BOM, wiring, firmware, assembly

## Reference

- Braitenberg, V. (1984). *Vehicles: Experiments in Synthetic Psychology*. MIT Press.
- PDF located at: `Vehicles-Experiments-in-Synthetic-Psychology-Valentino-Braitenberg.pdf`
