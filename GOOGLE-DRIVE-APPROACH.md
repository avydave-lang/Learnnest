# LearnNest Pilot – Google Drive + Google Sheets Approach

## Recommended structure

### Google Drive folder layout

```text
LearnNest Pilot/
  Mathematics/
    Algebra Foundations/
      Quadratic Equations/
        lesson-video.mp4
        notes.pdf
        slides.pptx
```

### Google Sheet columns

- `subject`
- `chapter`
- `topic`
- `content_type`
- `title`
- `file_link_or_id`
- `description`
- `order`
- `is_featured`
- `tags`

## Why this is the best next step

- parent can manage content from computer or phone
- no CSV upload needed inside the mobile app
- app can read one metadata source and render the library
- Google Drive remains the file store
- Google Sheet acts like a simple database

## Recommended workflow

1. Upload content into Google Drive folders
2. Add or update rows in the Google Sheet
3. App reads the sheet and groups items by:
   - Subject
   - Chapter
   - Topic
4. Student opens content from Drive links or embedded YouTube

## Pilot now, app later

- **Pilot now:** use local manifest / sample CSV
- **Next step:** swap local manifest for Google Sheet data
- **Later app:** use the same metadata model inside a mobile app

## Practical note for mobile

For the mobile version, the parent should not upload CSV from the phone app.
Instead:

- manage metadata in Google Sheets
- manage files in Google Drive
- let the child-facing app stay focused on learning and playback

## Next implementation step

After the metadata sheet is ready, the pilot can be updated to:

1. fetch published Google Sheet CSV/JSON
2. transform rows into the current Subject → Chapter → Topic view
3. open Drive files and YouTube links directly
