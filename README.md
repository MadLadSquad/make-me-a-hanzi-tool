# make-me-a-hanzi-tool
A (probably) working version of the make-me-a-hanzi tool.

How to build:
1. Install mongodb
1. Install node and run `npm i`
1. Install meteor using the following command:
    ```sh
    curl https://install.meteor.com/ | sh
    ```
1. Run `meteor run`

How to use:
1. Append a "#", followed by the character you want to edit in the URL like this: `localhost:3000/#A`
2. Write any data for your character if it doesn't exist
3. Select one of the 2 fonts from the list to edit your character
4. Go trough the tool
5. Keybindings:
    1. S - Go to the next page of the editor
    2. W - Go to the previous page
    3. R - Clear changes in the stroke editor
    4. N - Next character
6. Note: When cutting 2 intersecting strokes, create 1 or 2 rectangles in the overlapped area when cutting. If any unneeded strokes appear deselect them
