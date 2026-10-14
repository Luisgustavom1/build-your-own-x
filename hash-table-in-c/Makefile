CC := cc
CFLAGS := -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra

TARGET := main
SOURCES := src/main.c
HEADERS := src/hash_table.c src/hash_table.h

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(SOURCES) $(HEADERS)
	$(CC) $(CFLAGS) $(SOURCES) -o $@

clean:
	rm -f $(TARGET)