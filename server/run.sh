#!/bin/bash
res=$(bsondump backup/meteor/glyphs.bson 2> /dev/null)
./process.py "${res}"
