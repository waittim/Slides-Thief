# Examples

## Standard 16:9 deck

```bash
slides-thief ~/Downloads/slide-photos \
  --output-dir outputs/event-deck \
  --source-ratio 16:9 \
  --output-ratio match-slide \
  --width 2400 \
  --pdf-name event-deck.pdf
```

## Manual correction pass

```bash
slides-thief ~/Downloads/slide-photos \
  --output-dir outputs/event-deck-refined \
  --manual outputs/event-deck/manual_quads.json \
  --source-ratio 16:9 \
  --output-ratio match-slide \
  --width 2400
```
