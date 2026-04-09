# Google Sheet columns reference

| Column | Required | Example | Notes |
|---|---|---|---|
| `subject` | Yes | Mathematics | Top-level subject |
| `chapter` | Yes | Algebra Foundations | Chapter within subject |
| `topic` | Yes | Quadratic Equations | Topic within chapter |
| `content_type` | Yes | youtube / video / pdf / ppt / audio | Type of content |
| `title` | Yes | Quadratic Intro | Display title |
| `file_link_or_id` | Yes | Drive link or YouTube URL | Main resource pointer |
| `description` | No | Intro lesson | Shown in viewer |
| `order` | No | 1 | Sort order within topic |
| `is_featured` | No | TRUE | Show first in topic |
| `tags` | No | revision,formula | Optional search tags |

## Chapter metadata sheet

Use a separate sheet/file for chapter summaries that drive the student app overview cards.

| Column | Required | Example | Notes |
|---|---|---|---|
| `Subject` | Yes | Economics Standard XII | Subject shown in the app |
| `Chapter` | Yes | Utility Analysis | Chapter title |
| `Summary` | Yes | Defines total and marginal utility | Short chapter summary |
| `Detailed Summary` | No | Full chapter explanation | Expandable detailed chapter overview |
