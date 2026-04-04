"""
Synthetic scene descriptions for each mock camera.

Each camera has 8 variants: 7 nominal + 1 incident-seeded.
The worker picks one at random each poll cycle, giving ~1-in-8
odds of triggering an alarm — organic-feeling detection.
"""

CAMERAS = [
    {
        "id": "CAM-01",
        "label": "Main Entrance",
        "location": "Building front lobby, double glass doors, reception desk visible",
        "scenes": [
            "Lobby is quiet. A security guard is seated at the reception desk reading. No visitors present.",
            "Two employees badge in through the main doors carrying laptops. Normal morning activity.",
            "Lobby is empty. Lights on automatic dimming cycle. No movement detected.",
            "Delivery person drops off packages at reception. Guard signs for them and returns to desk.",
            "Three people exit through main doors; one holds the door for a colleague. Routine egress.",
            "Lobby empty except for guard who is reviewing paperwork at the desk.",
            "A group of four visitors in lanyards wait at reception while guard makes a phone call.",
            # Incident: fire/smoke
            "Dense grey smoke is visible rising from a trash can near the reception desk. Smoke is spreading across the ceiling. The guard appears to be coughing and backing away.",
        ],
    },
    {
        "id": "CAM-02",
        "label": "Parking Garage B2",
        "location": "Underground parking level 2, concrete pillars, 40 spaces, exit stairwell on east wall",
        "scenes": [
            "Parking level is empty. Fluorescent lights functioning normally. No vehicles or pedestrians.",
            "One car arrives and parks in bay 12. Driver exits and proceeds to the stairwell calmly.",
            "Two cars parked, no people visible. Quiet between shifts.",
            "Maintenance crew with a trolley moves between parked cars. ID badges clearly visible.",
            "Car alarm activates briefly on a silver sedan, then deactivates after 10 seconds.",
            "Security patrol officer walks the perimeter, checking vehicles with a flashlight.",
            "Level is at 60% capacity. Normal commuter traffic pattern, people coming and going.",
            # Incident: unauthorized access
            "A person in dark clothing is observed attempting to pry open the stairwell door with a tool. No badge or ID visible. The person looks around repeatedly in a furtive manner.",
        ],
    },
    {
        "id": "CAM-03",
        "label": "Server Room Corridor",
        "location": "Restricted-access hallway outside server room, keycard reader on door, no windows",
        "scenes": [
            "Corridor empty. All keycard readers showing green standby. No movement.",
            "IT technician badges in with a valid ID card. Enters server room normally.",
            "Corridor empty for extended period. Normal after-hours quiet.",
            "Two engineers exit the server room, discussing something. Both display valid badges.",
            "Cleaning staff stops in corridor, checks schedule on clipboard, moves on without attempting entry.",
            "Single person walks through corridor toward main building. Normal pedestrian path.",
            "Courier attempts to access corridor but is politely redirected by an IT staff member.",
            # Incident: unauthorized access
            "An unidentified individual without a visible badge is standing at the server room keycard reader, repeatedly swiping a card. The reader is flashing red each time. The person is looking around nervously between attempts.",
        ],
    },
    {
        "id": "CAM-04",
        "label": "Rooftop HVAC",
        "location": "Rooftop area, HVAC units, external stairwell access door visible, urban skyline background",
        "scenes": [
            "Rooftop empty. HVAC units running normally with visible heat shimmer. Wind in nearby flags.",
            "Maintenance technician with a tool belt is servicing an HVAC unit. ID badge clearly visible.",
            "Rooftop empty. Clear sky. All systems appear operational with no anomalies.",
            "Two technicians inspecting roof drainage system. Normal scheduled maintenance activity.",
            "Bird lands on an HVAC unit briefly, then flies away. No humans visible.",
            "Access door opens briefly then closes — likely wind pressure differential.",
            "Facilities crew arrives via access door, carrying equipment for an HVAC inspection.",
            # Incident: fire/smoke
            "Thick black smoke is rising from one of the HVAC units. The unit is vibrating abnormally. Smoke is spreading toward the rooftop access door and billowing upward.",
        ],
    },
    {
        "id": "CAM-05",
        "label": "Loading Dock",
        "location": "Rear loading dock, two truck bays, forklift staging area, dock supervisor office",
        "scenes": [
            "Loading dock is empty. Bay doors closed. Quiet between shifts, no activity.",
            "Delivery truck backs into bay 1. Two dock workers begin unloading pallets with a forklift.",
            "Forklift operator moves pallets from bay 2 to the staging area. Normal operations.",
            "Dock supervisor is checking a shipping manifest on a clipboard. One truck idle in bay 2.",
            "End of shift — dock workers clock out. Dock supervisor secures and locks bay doors.",
            "Empty dock during off-hours. Security lights on. No movement detected.",
            "Two workers having a brief conversation near the dock office before returning to work.",
            # Incident: crime/assault
            "A physical altercation is occurring between two individuals near bay 2. One person has shoved another against a concrete wall. A third person is attempting to intervene. Aggressive contact is ongoing.",
        ],
    },
    {
        "id": "CAM-06",
        "label": "Cafeteria",
        "location": "Employee cafeteria, 40 tables, serving area, emergency exit on south wall",
        "scenes": [
            "Cafeteria empty after meal service. Cleaning crew mopping floors near serving area.",
            "Lunch rush — cafeteria at 70% capacity. Normal activity, people eating and conversing.",
            "Small group of employees using corner tables for an informal meeting. Laptops open.",
            "Cafeteria mostly empty between meals. A few people with coffee at scattered tables.",
            "Catering delivery arriving through service entrance. Staff member directing the crew.",
            "Single employee eating alone at a corner table. All quiet and normal.",
            "Cafeteria closing for the evening. Last few employees finishing their meals.",
            # Incident: medical emergency
            "A person has collapsed near the serving line and is lying motionless on the floor. Two coworkers are kneeling beside them. One is on the phone, appearing to call for help. The collapsed individual is not responding or moving.",
        ],
    },
]
