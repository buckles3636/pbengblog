import type { Article, Block } from "./content";
const text = (id: string, value: string): Block => ({
  id,
  type: "paragraph",
  content: [{ type: "text", text: value, styles: {} }],
});
const heading = (id: string, value: string): Block => ({
  id,
  type: "heading",
  props: { level: 2 },
  content: [{ type: "text", text: value, styles: {} }],
});
export const demos: Article[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "bench-top-torque-sensor",
    title: "A bench-top torque sensor",
    summary:
      "A fictional design study in strain measurement, calibration, and a simple mechanical load path.",
    category: "Fictional demo · Instrumentation",
    cover: "/demo/torque-sensor.svg",
    version: 1,
    updatedAt: "2026-09-01T00:00:00.000Z",
    blocks: [
      text(
        "note",
        "This is an invented example for the PBEngBlog template. Dimensions and observations illustrate how to document a project; they are not validated design instructions.",
      ),
      heading("design", "Design intent"),
      text(
        "intro",
        "The imagined brief is a small fixture that compares the output torque of tabletop gearmotors. A floating motor mount transfers its reaction force through a measured lever arm to a load cell.",
      ),
      {
        id: "diagram",
        type: "image",
        props: {
          url: "/demo/torque-sensor.svg",
          caption:
            "Illustrative arrangement of the motor, lever arm, and load cell.",
        },
      },
      heading("math", "Show your work"),
      text(
        "explain",
        "Torque is the measured reaction force multiplied by the perpendicular lever-arm length. Keeping the load direction consistent makes the calibration easier to explain.",
      ),
      { id: "formula", type: "mathBlock", content: "\\tau = F r" },
      heading("next", "Keep a record"),
      text(
        "record",
        "An example test log would record the applied mass, lever length, zero offset, and temperature. A real build would need repeated measurements and an uncertainty estimate before drawing conclusions.",
      ),
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "compact-thermal-test-chamber",
    title: "A compact thermal test chamber",
    summary:
      "An invented notebook entry exploring insulation, temperature sensing, and a repeatable test procedure.",
    category: "Fictional demo · Test equipment",
    cover: "/demo/thermal-chamber.svg",
    version: 1,
    updatedAt: "2026-08-15T00:00:00.000Z",
    blocks: [
      text(
        "notice",
        "Fictional template project. This example demonstrates headings, equations, and a project image.",
      ),
      heading("brief", "The brief"),
      text(
        "brief-text",
        "Imagine a benchtop enclosure used to compare temperature sensors under the same conditions. The design notebook separates the enclosure, measurement system, and operating procedure so each can be reviewed independently.",
      ),
      {
        id: "chamber",
        type: "image",
        props: {
          url: "/demo/thermal-chamber.svg",
          caption: "Concept sketch, not a fabrication drawing.",
        },
      },
      heading("model", "A first-order model"),
      {
        id: "heat",
        type: "mathBlock",
        content: "C\\frac{dT}{dt}=P-\\frac{T-T_a}{R_\\mathrm{th}}",
      },
      text(
        "model-text",
        "The simplified model relates thermal capacitance, heating power, ambient temperature, and thermal resistance. It is a useful starting point for a discussion of response time.",
      ),
      heading("lessons", "What to investigate"),
      text(
        "lessons-text",
        "A real test would compare several sensor positions, check the temperature gradient, and document any overshoot. Include the raw observations alongside the explanation.",
      ),
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    slug: "precision-camera-slider",
    title: "A precision camera slider",
    summary:
      "A fictional motion-control project covering drive ratios, homing, and a clear record of design tradeoffs.",
    category: "Fictional demo · Mechanisms",
    cover: "/demo/camera-slider.svg",
    version: 1,
    updatedAt: "2026-07-20T00:00:00.000Z",
    blocks: [
      text(
        "notice",
        "This project is a fictional example included with the open-source template.",
      ),
      heading("motion", "Define the motion"),
      text(
        "motion-text",
        "The imagined slider moves a small camera along a linear guide. This writeup starts with the desired travel and speed, then works backward through the pulley and motor choices.",
      ),
      {
        id: "slider",
        type: "image",
        props: {
          url: "/demo/camera-slider.svg",
          caption: "Illustrative belt-driven carriage.",
        },
      },
      heading("resolution", "Command resolution"),
      {
        id: "steps",
        type: "mathBlock",
        content: "\\Delta x=\\frac{p N_t}{N_s M}",
      },
      text(
        "resolution-text",
        "Here p is belt pitch, Nₜ the pulley tooth count, Nₛ full steps per revolution, and M the microstep setting. Command resolution alone does not establish positioning accuracy.",
      ),
      heading("verify", "Document the verification"),
      text(
        "verify-text",
        "A real experiment would measure repeatability from both travel directions and compare slow and fast moves. Record backlash, deflection, and missed steps rather than assuming the ideal calculation tells the whole story.",
      ),
    ],
  },
];
export const demo = demos[0];
