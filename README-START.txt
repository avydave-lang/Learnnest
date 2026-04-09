To run this pilot locally and see subjects/topics:

1. Open a terminal in the 'pilot' folder.
2. Run this command:

    python -m http.server 8000

3. Open your browser and go to:

    http://localhost:8000/

This will allow the app to fetch topics.md and display the UI.

(Opening index.html directly will not work due to browser security restrictions.)

How to add content:

1. Put files into the matching topic folder, for example:

    content/Mathematics/Quadratic Equations/

2. Open:

    content/content-manifest.json

3. Add entries like this:

    {
      "title": "Factorisation Video",
      "type": "video",
      "file": "content/Mathematics/Quadratic Equations/factorisation.mp4"
    }

Supported types for now:
- video
- pdf
- ppt
- audio
- youtube

YouTube example:

    {
      "title": "YouTube Lesson",
      "type": "youtube",
      "file": "https://www.youtube.com/watch?v=VIDEO_ID"
    }

Parent upload screen:

    http://localhost:8000/parent.html

CSV columns for the parent page:
- subject
- topic
- content_type
- content_name_or_link
- description

Recommended extra columns for local files:
- source_folder   (folder inside the parent's source root)
or
- source_path     (full relative path to the file)

Optional extra column:
- chapter

Parent flow now works like this:
- upload the CSV
- connect the parent's source root folder once
- connect the app `content` folder once
- import into the app

The parent page can then:
- update `content-manifest.json`
- copy video / pdf / ppt / audio files into the right folder structure automatically from the CSV folder/path
- keep YouTube rows as embedded `youtube` links
