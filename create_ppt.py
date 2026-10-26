#!/usr/bin/env python3
"""Generate CanopyAI hackathon presentation."""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# Colors
BG_DARK = RGBColor(0x0D, 0x0D, 0x1A)
BG_CARD = RGBColor(0x1E, 0x1B, 0x4B)
INDIGO = RGBColor(0x81, 0x8C, 0xF8)
INDIGO_BRIGHT = RGBColor(0x63, 0x66, 0xF1)
WHITE = RGBColor(0xE5, 0xE7, 0xEB)
LIGHT_GRAY = RGBColor(0x9C, 0xA3, 0xAF)
GREEN = RGBColor(0x10, 0xB9, 0x81)
BLUE = RGBColor(0x3B, 0x82, 0xF6)
CYAN = RGBColor(0x00, 0xAC, 0xD7)
YELLOW = RGBColor(0xF5, 0x9E, 0x0B)
PINK = RGBColor(0xEC, 0x48, 0x99)
ORANGE = RGBColor(0xF9, 0x73, 0x16)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)


def add_bg(slide):
    """Add dark background to slide."""
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = BG_DARK


def add_text(slide, left, top, width, height, text, font_size=18, color=WHITE, bold=False, align=PP_ALIGN.LEFT, font_name="Calibri"):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = align
    return txBox


def add_shape_with_text(slide, left, top, width, height, text, fill_color, text_color=WHITE, font_size=14, bold=False, shape=MSO_SHAPE.ROUNDED_RECTANGLE):
    shp = slide.shapes.add_shape(shape, Inches(left), Inches(top), Inches(width), Inches(height))
    shp.fill.solid()
    shp.fill.fore_color.rgb = fill_color
    shp.line.fill.background()
    tf = shp.text_frame
    tf.word_wrap = True
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = text_color
    p.font.bold = bold
    p.font.name = "Calibri"
    return shp


def add_bullet_list(slide, left, top, width, height, items, font_size=16, color=WHITE, spacing=Pt(8)):
    txBox = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = item
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.font.name = "Calibri"
        p.space_after = spacing
        p.level = 0
    return txBox


# ============================================================
# SLIDE 1: Title Slide
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank
add_bg(slide)

# Accent line
shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.5), Inches(1.2), Inches(2.3), Pt(4))
shp.fill.solid()
shp.fill.fore_color.rgb = INDIGO
shp.line.fill.background()

add_text(slide, 1, 1.5, 11, 1.5, "CanopyAI", font_size=64, color=INDIGO, bold=True, align=PP_ALIGN.CENTER)
add_text(slide, 1, 2.8, 11, 1, "AI-Powered Codebase Visualization & Exploration", font_size=28, color=WHITE, align=PP_ALIGN.CENTER)
add_text(slide, 1, 3.8, 11, 0.8, "See your code. Understand your code. Transform your code.", font_size=20, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

# Team badge
add_shape_with_text(slide, 5.2, 5.2, 3, 0.6, "Team PRIMATES", BG_CARD, INDIGO, font_size=18, bold=True)
add_text(slide, 1, 6.0, 11, 0.5, "IBM Granite Hackathon", font_size=16, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

# Tech pills at bottom
techs = ["VS Code Extension", "React", "TypeScript", "IBM Granite", "SVG Graphs"]
colors = [INDIGO_BRIGHT, BLUE, BLUE, GREEN, PINK]
start_x = 2.8
for i, tech in enumerate(techs):
    add_shape_with_text(slide, start_x + i * 1.7, 6.5, 1.5, 0.4, tech, BG_CARD, colors[i], font_size=10, bold=True)


# ============================================================
# SLIDE 2: Why We Built This
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "Why We Built CanopyAI", font_size=44, color=INDIGO, bold=True)

# The story / motivation - left side
shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.6), Inches(6), Inches(5.3))
shp.fill.solid()
shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

add_text(slide, 1.2, 1.8, 5.2, 0.5, "The Motivation", font_size=26, color=GREEN, bold=True)

motivation_text = (
    "Every developer has faced it — you open a new codebase and\n"
    "feel completely lost. Hundreds of files, tangled imports,\n"
    "undocumented functions. You spend hours just figuring out\n"
    "where things are before you can write a single line of code.\n\n"
    "We asked ourselves: What if you could SEE the entire codebase\n"
    "at a glance? What if AI could explain every file instantly?\n"
    "What if understanding code was as simple as clicking a node?\n\n"
    "That's why we built CanopyAI — to make codebases visual,\n"
    "interactive, and AI-assisted. So no developer ever has to\n"
    "feel lost in code again."
)
add_text(slide, 1.2, 2.5, 5.4, 4, motivation_text, font_size=16, color=LIGHT_GRAY)

# Right side - key stats that justify the need
add_text(slide, 7.5, 1.6, 5, 0.5, "The Reality", font_size=26, color=PINK, bold=True)

stats = [
    ("58%", "of developer time is spent\nunderstanding existing code,\nnot writing new code", INDIGO),
    ("6+ months", "average onboarding time for\na developer joining a large\ncodebase project", BLUE),
    ("60%", "of bugs are introduced during\nchanges to code the developer\ndidn't fully understand", PINK),
    ("3-5x", "faster onboarding when developers\nhave visual maps and AI-assisted\ncode explanations", GREEN),
]

for i, (stat, desc, color) in enumerate(stats):
    y = 2.3 + i * 1.2
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.5), Inches(y), Inches(5), Inches(1.05))
    shp.fill.solid()
    shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
    shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    add_text(slide, 7.7, y + 0.05, 1.5, 0.9, stat, font_size=24, color=color, bold=True)
    add_text(slide, 9.3, y + 0.05, 3, 0.9, desc, font_size=13, color=LIGHT_GRAY)


# ============================================================
# SLIDE 3: The Problem
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "The Problem", font_size=44, color=INDIGO, bold=True)
add_text(slide, 0.8, 1.1, 11, 0.5, "Modern development is broken — developers spend more time reading code than writing it", font_size=18, color=LIGHT_GRAY)

# Problem cards
problems = [
    ("Codebase Complexity", "Large projects have hundreds of interconnected files.\nUnderstanding structure and dependencies is\noverwhelming — especially for new team members."),
    ("Onboarding Friction", "New developers spend days or weeks reading code\nbefore they can contribute. There's no quick way to\ngrasp what each file does or how they connect."),
    ("Hidden Dependencies", "Import chains and function call relationships are\nburied deep in code. Refactoring without visibility\ninto these connections leads to cascading breakage."),
    ("Context Switching", "Developers constantly jump between files, terminals,\nbrowsers, and docs. There's no single unified view\nthat combines structure with AI-powered insight."),
]

for i, (title, desc) in enumerate(problems):
    col = i % 2
    row = i // 2
    x = 0.8 + col * 6
    y = 1.9 + row * 2.5

    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(5.5), Inches(2.1))
    shp.fill.solid()
    shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
    shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    shp.line.width = Pt(1)

    # Accent bar
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Pt(4), Inches(2.1))
    bar.fill.solid()
    bar.fill.fore_color.rgb = INDIGO
    bar.line.fill.background()

    add_text(slide, x + 0.3, y + 0.2, 5, 0.5, title, font_size=22, color=INDIGO, bold=True)
    add_text(slide, x + 0.3, y + 0.8, 5, 1.2, desc, font_size=15, color=LIGHT_GRAY)

# Bottom call-to-action
add_text(slide, 0.8, 6.6, 11.7, 0.5, "We needed a tool that lets you see, understand, and transform code — all in one place.", font_size=18, color=WHITE, bold=True, align=PP_ALIGN.CENTER)


# ============================================================
# SLIDE 3: The Solution
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "Our Solution: CanopyAI", font_size=44, color=INDIGO, bold=True)
add_text(slide, 0.8, 1.2, 11, 0.6, "A VS Code extension that turns your codebase into an interactive, AI-powered visual experience", font_size=18, color=LIGHT_GRAY)

features = [
    (INDIGO, "Interactive Graph", "Visualize your entire project\nas a navigable SVG tree\nwith pan, zoom, and click"),
    (GREEN, "AI Explanations", "Click any file — IBM Granite\nexplains it in 2 sentences.\nNo more guessing."),
    (BLUE, "Dependency Map", "See imports & function calls\nacross your codebase as\nan interactive graph"),
    (PINK, "Chat & Edit", "Ask questions about code,\nget AI-suggested changes,\napply with one click"),
]

for i, (color, title, desc) in enumerate(features):
    x = 0.8 + i * 3.1
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(2.2), Inches(2.8), Inches(4.5))
    shp.fill.solid()
    shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
    shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    shp.line.width = Pt(1)

    # Color dot
    dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x + 1.1), Inches(2.5), Inches(0.6), Inches(0.6))
    dot.fill.solid()
    dot.fill.fore_color.rgb = color
    dot.line.fill.background()

    add_text(slide, x + 0.2, 3.3, 2.4, 0.6, title, font_size=22, color=color, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, x + 0.2, 4.1, 2.4, 2, desc, font_size=15, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)


# ============================================================
# SLIDE 4: Architecture
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "Architecture", font_size=44, color=INDIGO, bold=True)

# Extension layer
add_shape_with_text(slide, 0.8, 1.6, 5.5, 0.7, "VS Code Extension (TypeScript)", BG_CARD, INDIGO, font_size=18, bold=True)

services = [
    ("extension.ts", "Entry Point"),
    ("webviewProvider.ts", "Message Broker"),
    ("fileSystemService.ts", "File I/O"),
    ("bobService.ts", "AI Integration"),
    ("dependencyService.ts", "Code Analysis"),
]

for i, (name, desc) in enumerate(services):
    y = 2.6 + i * 0.7
    add_shape_with_text(slide, 1.0, y, 2.2, 0.55, name, RGBColor(0x11, 0x18, 0x27), BLUE, font_size=13, bold=True)
    add_text(slide, 3.4, y + 0.05, 2.8, 0.5, desc, font_size=14, color=LIGHT_GRAY)

# Arrow
add_text(slide, 5.8, 3.2, 1.5, 0.5, "postMessage", font_size=14, color=INDIGO, bold=True, align=PP_ALIGN.CENTER)
arrow = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(6.0), Inches(3.7), Inches(1.2), Inches(0.3))
arrow.fill.solid()
arrow.fill.fore_color.rgb = INDIGO
arrow.line.fill.background()

# Webview layer
add_shape_with_text(slide, 7.5, 1.6, 5, 0.7, "Webview Layer (React + TypeScript)", BG_CARD, GREEN, font_size=18, bold=True)

views = [
    ("Graph View", "Interactive SVG tree visualization", INDIGO),
    ("Dependency View", "Import & call relationship graph", BLUE),
    ("Chat Panel", "Conversational AI interface", GREEN),
    ("File Tree", "Sidebar navigation", YELLOW),
    ("Context Menu", "Right-click actions", PINK),
]

for i, (name, desc, color) in enumerate(views):
    y = 2.6 + i * 0.7
    add_shape_with_text(slide, 7.7, y, 2.0, 0.55, name, RGBColor(0x11, 0x18, 0x27), color, font_size=13, bold=True)
    add_text(slide, 9.9, y + 0.05, 2.5, 0.5, desc, font_size=14, color=LIGHT_GRAY)

# External
add_shape_with_text(slide, 4.5, 6.2, 4.3, 0.6, "IBM Granite (via Bob CLI)", RGBColor(0x11, 0x18, 0x27), GREEN, font_size=16, bold=True)


# ============================================================
# SLIDE 5: Graph Visualization Deep Dive
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "Interactive Graph Visualization", font_size=44, color=INDIGO, bold=True)
add_text(slide, 0.8, 1.2, 11, 0.6, "Your codebase as a navigable, color-coded visual tree", font_size=18, color=LIGHT_GRAY)

# Feature cards
graph_features = [
    ("File Nodes", "Language-specific colors with\ntype badges (TS, PY, GO, etc.)\nand left accent bars", BLUE),
    ("Folder Nodes", "Expandable directory containers\nwith indigo accent styling\nand hierarchy display", INDIGO),
    ("Pan & Zoom", "Scroll to zoom (0.3x–2x)\nDrag to pan across the graph\nSmooth cursor transitions", GREEN),
    ("Click to Explain", "Select any file node to trigger\nIBM Granite analysis —\n2-sentence explanation appears", PINK),
    ("Hover Effects", "Nodes glow on hover with\nindigo highlight. Unrelated\nnodes dim to 20% opacity", YELLOW),
    ("Pulse Animation", "Explained nodes pulse with\noscillating opacity (0.6–1.0)\nover 2-second cycles", ORANGE),
]

for i, (title, desc, color) in enumerate(graph_features):
    col = i % 3
    row = i // 3
    x = 0.8 + col * 4.1
    y = 2.0 + row * 2.7

    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(3.7), Inches(2.3))
    shp.fill.solid()
    shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
    shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x + 0.2), Inches(y + 0.2), Inches(0.3), Inches(0.3))
    dot.fill.solid()
    dot.fill.fore_color.rgb = color
    dot.line.fill.background()

    add_text(slide, x + 0.6, y + 0.15, 3, 0.5, title, font_size=20, color=color, bold=True)
    add_text(slide, x + 0.3, y + 0.8, 3.2, 1.5, desc, font_size=14, color=LIGHT_GRAY)


# ============================================================
# SLIDE 6: Dependency Analysis
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "Dependency Analysis Engine", font_size=44, color=INDIGO, bold=True)
add_text(slide, 0.8, 1.2, 6, 0.6, "Multi-language parser mapping imports & function calls", font_size=18, color=LIGHT_GRAY)

# Languages supported
add_text(slide, 0.8, 2.0, 6, 0.5, "Languages Supported", font_size=22, color=WHITE, bold=True)
langs = [
    ("TypeScript", BLUE), ("JavaScript", YELLOW), ("Python", GREEN),
    ("Go", CYAN), ("Java", ORANGE), ("Rust", PINK),
]
for i, (lang, color) in enumerate(langs):
    col = i % 3
    row = i // 3
    add_shape_with_text(slide, 0.8 + col * 2.1, 2.6 + row * 0.65, 1.8, 0.5, lang, BG_CARD, color, font_size=14, bold=True)

# How it works
add_text(slide, 0.8, 4.2, 6, 0.5, "How It Works", font_size=22, color=WHITE, bold=True)

steps = [
    "1. Scans workspace files (up to 200 files)",
    "2. Extracts imports using language-specific regex",
    "3. Extracts function definitions & exports",
    "4. Resolves import paths across the project",
    "5. Detects function call relationships",
    "6. Groups nodes by folder for visualization",
]
add_bullet_list(slide, 0.8, 4.8, 6, 2.5, steps, font_size=15, color=LIGHT_GRAY, spacing=Pt(4))

# Right side - edge types
add_text(slide, 7.5, 2.0, 5, 0.5, "Visual Encoding", font_size=22, color=WHITE, bold=True)

# Import edge
shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.5), Inches(2.7), Inches(5), Inches(1.5))
shp.fill.solid()
shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)
add_text(slide, 7.8, 2.8, 4, 0.4, "- - - -  Import Relationships", font_size=18, color=LIGHT_GRAY, bold=True)
add_text(slide, 7.8, 3.3, 4.5, 0.8, "Dashed lines connecting files that import from each other.\nOpacity 0.4, gray color (#4b5563)", font_size=14, color=LIGHT_GRAY)

# Call edge
shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.5), Inches(4.5), Inches(5), Inches(1.5))
shp.fill.solid()
shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)
add_text(slide, 7.8, 4.6, 4, 0.4, "———  Function Call Relationships", font_size=18, color=INDIGO, bold=True)
add_text(slide, 7.8, 5.1, 4.5, 0.8, "Solid indigo lines with arrows showing which functions\ncall which. Opacity 0.6, brightens to 0.9 on hover", font_size=14, color=LIGHT_GRAY)

# Interaction
add_text(slide, 7.5, 6.3, 5, 0.5, "Interactions", font_size=22, color=WHITE, bold=True)
add_text(slide, 7.5, 6.8, 5, 0.5, "Click file to expand functions  |  Hover to highlight connections", font_size=14, color=LIGHT_GRAY)


# ============================================================
# SLIDE 7: AI Integration
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "AI-Powered Features", font_size=44, color=INDIGO, bold=True)
add_text(slide, 0.8, 1.1, 11, 0.6, "IBM Granite via Bob CLI — bringing intelligence to every interaction", font_size=18, color=LIGHT_GRAY)

# Feature 1: Explanations
shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(2.0), Inches(5.7), Inches(2.3))
shp.fill.solid()
shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

add_text(slide, 1.1, 2.1, 5, 0.5, "1  File Explanations", font_size=24, color=GREEN, bold=True)
add_text(slide, 1.1, 2.7, 5.2, 1.5,
    "Click any file in the graph to get an instant AI summary.\n"
    "IBM Granite reads the file content (up to 8000 chars) and\n"
    "returns a concise 2-sentence explanation.\n\n"
    "Appears as an overlay card with a pulsing animation.",
    font_size=15, color=LIGHT_GRAY)

# Feature 2: Chat
shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(2.0), Inches(5.7), Inches(2.3))
shp.fill.solid()
shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

add_text(slide, 7.1, 2.1, 5, 0.5, "2  Conversational Chat", font_size=24, color=BLUE, bold=True)
add_text(slide, 7.1, 2.7, 5.2, 1.5,
    "Full chat interface with conversation history.\n"
    "Ask questions about any file in your codebase.\n"
    "Granite maintains context about the current file\n"
    "and provides detailed technical answers.",
    font_size=15, color=LIGHT_GRAY)

# Feature 3: Code Changes
shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.7), Inches(5.7), Inches(2.3))
shp.fill.solid()
shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

add_text(slide, 1.1, 4.8, 5, 0.5, "3  One-Click Code Apply", font_size=24, color=PINK, bold=True)
add_text(slide, 1.1, 5.4, 5.2, 1.5,
    "Ask Granite to modify code — it returns the complete\n"
    "updated file in a code block. Click 'Apply to file' to\n"
    "save changes directly to your workspace.\n"
    "Green checkmark confirms the change was applied.",
    font_size=15, color=LIGHT_GRAY)

# Feature 4: How it works
shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(4.7), Inches(5.7), Inches(2.3))
shp.fill.solid()
shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

add_text(slide, 7.1, 4.8, 5, 0.5, "Under the Hood", font_size=24, color=YELLOW, bold=True)
add_text(slide, 7.1, 5.4, 5.2, 1.5,
    "Prompt  -->  Temp file  -->  Bob CLI (JSON mode)\n"
    "                           -->  Parse response  -->  Display\n\n"
    "Timeout: 120s  |  Buffer: 5MB  |  Auto-cleanup",
    font_size=15, color=LIGHT_GRAY)


# ============================================================
# SLIDE 8: User Experience Flow
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "User Experience", font_size=44, color=INDIGO, bold=True)

steps = [
    ("1", "Open VS Code", "Command Palette:\n'CanopyAI: Open Panel'", INDIGO),
    ("2", "Explore Graph", "See your full project\nas a visual tree", BLUE),
    ("3", "Click a File", "Get instant AI explanation\nin 2 sentences", GREEN),
    ("4", "Ask Questions", "Chat with Granite\nabout any file", YELLOW),
    ("5", "Apply Changes", "One-click apply AI\nsuggested code edits", PINK),
    ("6", "View Dependencies", "Switch to dependency tab\nto see import/call graph", ORANGE),
]

for i, (num, title, desc, color) in enumerate(steps):
    x = 0.5 + i * 2.15
    # Number circle
    dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x + 0.5), Inches(1.8), Inches(0.8), Inches(0.8))
    dot.fill.solid()
    dot.fill.fore_color.rgb = color
    dot.line.fill.background()
    tf = dot.text_frame
    tf.paragraphs[0].text = num
    tf.paragraphs[0].font.size = Pt(28)
    tf.paragraphs[0].font.color.rgb = WHITE
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    tf.word_wrap = False

    add_text(slide, x, 2.9, 1.9, 0.5, title, font_size=18, color=color, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, x, 3.5, 1.9, 1.2, desc, font_size=13, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)

    # Arrow between steps
    if i < 5:
        arrow = slide.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Inches(x + 1.85), Inches(2.05), Inches(0.35), Inches(0.2))
        arrow.fill.solid()
        arrow.fill.fore_color.rgb = RGBColor(0x1F, 0x29, 0x37)
        arrow.line.fill.background()

# Key interactions section
add_text(slide, 0.8, 5.0, 11, 0.5, "Key Interactions", font_size=24, color=WHITE, bold=True)

interactions = [
    ("Left Click", "Select file, trigger AI explanation", INDIGO),
    ("Right Click", "Context menu: Explain, Chat, View, Rename", BLUE),
    ("Scroll", "Zoom in/out (0.3x to 2x range)", GREEN),
    ("Drag", "Pan across the graph view", YELLOW),
    ("Hover", "Highlight node + connected dependencies", PINK),
]

for i, (action, desc, color) in enumerate(interactions):
    x = 0.8 + i * 2.5
    add_shape_with_text(slide, x, 5.6, 1.2, 0.45, action, BG_CARD, color, font_size=12, bold=True)
    add_text(slide, x, 6.2, 2.3, 0.8, desc, font_size=12, color=LIGHT_GRAY)


# ============================================================
# SLIDE 9: Tech Stack
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "Technology Stack", font_size=44, color=INDIGO, bold=True)

categories = [
    ("Frontend / Webview", [
        ("React 18", "Component-based UI with hooks"),
        ("TypeScript 5.3", "Type-safe development"),
        ("Vite 5.1", "Fast bundling & HMR"),
        ("Pure SVG", "Custom graph rendering — no D3"),
    ], BLUE),
    ("Extension / Backend", [
        ("VS Code API 1.85", "Webview panels & file system"),
        ("Node.js 18+", "Extension host runtime"),
        ("postMessage API", "Bidirectional communication"),
        ("File System Service", "Read, write, rename, scan"),
    ], GREEN),
    ("AI Layer", [
        ("IBM Granite", "Foundation model for code understanding"),
        ("Bob CLI", "Shell interface to Granite (JSON mode)"),
        ("Prompt Engineering", "2-sentence explanations, chat context"),
        ("Code Block Parsing", "Extract & apply AI-suggested changes"),
    ], PINK),
]

for i, (cat_name, items, color) in enumerate(categories):
    x = 0.8 + i * 4.2
    add_text(slide, x, 1.5, 3.8, 0.5, cat_name, font_size=24, color=color, bold=True)

    for j, (tech, desc) in enumerate(items):
        y = 2.3 + j * 1.2
        shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(3.8), Inches(1.0))
        shp.fill.solid()
        shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
        shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

        add_text(slide, x + 0.2, y + 0.05, 3.4, 0.4, tech, font_size=16, color=color, bold=True)
        add_text(slide, x + 0.2, y + 0.5, 3.4, 0.4, desc, font_size=13, color=LIGHT_GRAY)


# ============================================================
# SLIDE 10: Demo / Key Metrics
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "By the Numbers", font_size=44, color=INDIGO, bold=True)

metrics = [
    ("200", "Files Analyzed", "Max dependency graph scope", INDIGO),
    ("6", "Languages", "TS, JS, Python, Go, Java, Rust", BLUE),
    ("20+", "File Types", "Color-coded and recognized", GREEN),
    ("3", "View Modes", "Graph, Dependencies, Chat", YELLOW),
    ("<2s", "AI Response", "File explanation latency", PINK),
    ("1-Click", "Apply Changes", "AI code to workspace", ORANGE),
]

for i, (num, label, desc, color) in enumerate(metrics):
    col = i % 3
    row = i // 3
    x = 1.5 + col * 3.8
    y = 1.8 + row * 2.8

    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(3.2), Inches(2.3))
    shp.fill.solid()
    shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
    shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    add_text(slide, x, y + 0.2, 3.2, 0.9, num, font_size=52, color=color, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, x, y + 1.1, 3.2, 0.5, label, font_size=20, color=WHITE, bold=True, align=PP_ALIGN.CENTER)
    add_text(slide, x, y + 1.6, 3.2, 0.5, desc, font_size=14, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)


# ============================================================
# SLIDE 11: What Makes Us Different
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

add_text(slide, 0.8, 0.4, 11, 0.8, "What Sets CanopyAI Apart", font_size=44, color=INDIGO, bold=True)

diffs = [
    ("Zero Setup", "Works directly with your VS Code workspace.\nNo uploads, no GitHub cloning, no config files.\nJust open the panel and go.", GREEN),
    ("Native Integration", "Built as a VS Code extension — not a separate app.\nReads and writes files directly in your workspace.\nNo context switching needed.", BLUE),
    ("Visual + AI Combined", "Not just a graph tool. Not just an AI chat.\nThe combination of visual navigation with\nAI explanations is uniquely powerful.", INDIGO),
    ("Multi-Language", "Single tool handles TypeScript, JavaScript,\nPython, Go, Java, and Rust. One graph for\nyour entire polyglot codebase.", PINK),
]

for i, (title, desc, color) in enumerate(diffs):
    y = 1.6 + i * 1.45
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(y), Inches(11.7), Inches(1.25))
    shp.fill.solid()
    shp.fill.fore_color.rgb = RGBColor(0x11, 0x18, 0x27)
    shp.line.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # Color bar
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(y), Pt(5), Inches(1.25))
    bar.fill.solid()
    bar.fill.fore_color.rgb = color
    bar.line.fill.background()

    add_text(slide, 1.2, y + 0.1, 3, 0.5, title, font_size=22, color=color, bold=True)
    add_text(slide, 4.5, y + 0.15, 7.5, 1.0, desc, font_size=15, color=LIGHT_GRAY)


# ============================================================
# SLIDE 12: Thank You
# ============================================================
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_bg(slide)

shp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.5), Inches(1.8), Inches(2.3), Pt(4))
shp.fill.solid()
shp.fill.fore_color.rgb = INDIGO
shp.line.fill.background()

add_text(slide, 1, 2.2, 11, 1.2, "CanopyAI", font_size=56, color=INDIGO, bold=True, align=PP_ALIGN.CENTER)
add_text(slide, 1, 3.3, 11, 0.8, "See your code. Understand your code. Transform your code.", font_size=24, color=WHITE, align=PP_ALIGN.CENTER)

add_shape_with_text(slide, 5.2, 4.5, 3, 0.6, "Team PRIMATES", BG_CARD, INDIGO, font_size=20, bold=True)

add_text(slide, 1, 5.5, 11, 0.5, "Thank You!", font_size=36, color=INDIGO, bold=True, align=PP_ALIGN.CENTER)
add_text(slide, 1, 6.2, 11, 0.5, "Built with React  |  TypeScript  |  VS Code API  |  IBM Granite", font_size=16, color=LIGHT_GRAY, align=PP_ALIGN.CENTER)


# Save
output_path = "/Users/lakshgoyal/IBM_BOB/CanopyAI_Presentation.pptx"
prs.save(output_path)
print(f"Presentation saved to: {output_path}")
print(f"Total slides: {len(prs.slides)}")
