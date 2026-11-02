#include <assert.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>
#include <unistd.h>
#include <string.h>

struct free_area {
  uint8_t marker;
  bool in_use;
  uint32_t length;
  struct free_area *prev;
  struct free_area *next;
};

struct stats {
  int magical_bytes;
  bool lock;
  uint32_t blocks;
  uint32_t pages;
};

typedef struct stats my_stats;
typedef struct free_area area;

const int MAGICAL_BYTES = 0x55;
const int BLOCK_MARKER = 0xDD;
const int PAGE_SIZE = 4096;

char *heap_start = NULL;

my_stats *get_malloc_header() {
  assert(heap_start != NULL);
  my_stats *malloc_header = (my_stats *)heap_start;
  assert(malloc_header->magical_bytes == MAGICAL_BYTES);
  return malloc_header;
}

area *find_last_block() {
  my_stats *malloc_header = get_malloc_header();
  area *block = (area *)((char *)malloc_header + sizeof(my_stats));
  while (block->next != NULL) {
    block = block->next;
  }
  return block;
}

area *find_previous_used_block(area *ptr) {
  area *mov_ptr = ptr;
  while (mov_ptr->prev != NULL) {
    mov_ptr = mov_ptr->prev;
    if (mov_ptr->in_use == true) {
      return mov_ptr;
    }
  }
  return NULL;
}

int *add_used_block(ssize_t size) {
  my_stats *malloc_header = get_malloc_header();
  // wait for lock to be released
  while (malloc_header->lock) {
    sleep(1);
  }
  malloc_header->lock = true;

  // find smallest space in the free blocks and add there
  area *block = (area *)((char *)heap_start + sizeof(my_stats)); // ***
  area *smallest_block = NULL;
  area *last_block = block;

  // best fit
  while (block != NULL) {
    assert(block->marker == BLOCK_MARKER);
    if ((block->length) + sizeof(area) >= size && block->in_use == false) {
      if (smallest_block == NULL || block->length < smallest_block->length) {
        smallest_block = block;
      }
    }
    last_block = block;
    block = block->next;
  }

  // no big enough blocks
  if (smallest_block == NULL) {
    area *last_block = find_last_block();
    while (last_block->length < size) { // add more pages until we have enough space
      sbrk(4096);
      last_block->length += 4096;
      malloc_header->pages += 1;
    }
    smallest_block = last_block;
  }

  smallest_block->in_use = true;

  int must_have_size = smallest_block->length - size - sizeof(area) - 1; // ***
  if (must_have_size <= 0) {
    sbrk(4096);
    malloc_header->pages += 1;
    last_block->length += 4096;
    must_have_size = last_block->length - size - sizeof(area) - 1;
  }

  int remaining_size = must_have_size + 1;
  malloc_header->blocks += 1;
  area *new_block = (area *)((char *)smallest_block + sizeof(area) + size);
  new_block->marker = BLOCK_MARKER;
  new_block->length = remaining_size;
  new_block->prev = smallest_block;
  new_block->next = smallest_block->next;
  if (new_block->next != NULL) {
    new_block->next->prev = new_block;
  }
  smallest_block->next = new_block;
  smallest_block->length = size; // ***

  malloc_header->lock = false;
  return (int *)((char *)smallest_block + sizeof(area));
}

int *l_malloc(ssize_t size) {
  if (heap_start == NULL) {
    heap_start = sbrk(0);
    sbrk(4096);
  }

  char *heap_end = sbrk(0);
  long int length = heap_end - heap_start;

  if ((*heap_start) != MAGICAL_BYTES) {
    *(heap_start) = MAGICAL_BYTES;
    my_stats *malloc_header = (my_stats *)heap_start;

    malloc_header->blocks = 1;
    malloc_header->pages = 1;

    area *first_block = (area *)((char *)heap_start + sizeof(my_stats));

    first_block->marker = BLOCK_MARKER;
    first_block->in_use = false;
    first_block->length = length - sizeof(my_stats) - sizeof(area);
    first_block->prev = NULL;
    first_block->next = NULL;
  }

  return add_used_block(size);
}

void reduce_heap_size_if_possible() {
  area *last_block = find_last_block();
  area *prev_used_block = find_previous_used_block(last_block);
  if (prev_used_block == NULL) {
    if (last_block->length > PAGE_SIZE) {
      last_block->length = PAGE_SIZE;
    }
    prev_used_block = last_block;
  }
  void *new_end = (void *)prev_used_block + sizeof(area) + prev_used_block->length;
  void *heap_end = sbrk(0);

  while (new_end < heap_end - PAGE_SIZE) {
    sbrk(-PAGE_SIZE);
    heap_end = sbrk(0);
    my_stats *malloc_header = get_malloc_header();
    malloc_header->pages -= 1;
  }

  if (heap_end - new_end > sizeof(area) + 1) {
    area *new_not_used_block = (area *)new_end;
    new_not_used_block->marker = BLOCK_MARKER;
    new_not_used_block->in_use = false;
    new_not_used_block->prev = prev_used_block;
    new_not_used_block->next = NULL;
    new_not_used_block->length = heap_end - new_end - sizeof(area);
    prev_used_block->next = new_not_used_block;
  }
}

bool l_free(void *ptr) {
  my_stats *malloc_header = get_malloc_header();
  while (malloc_header->lock) {
    sleep(1);
  }
  malloc_header->lock = true;
  // free does not get the start of the block but the start of the data area of the block
  area *block = ptr - sizeof(area);
  if (block->marker != BLOCK_MARKER) {
    return false;
  } else {
    block->in_use = false;
    memset(ptr, 0, block->length);
    if (block->next != NULL && (block->next)->in_use == false) {
      area *not_used_next_block = block->next;
      if (not_used_next_block != NULL) { // *** check if is unnecessary
        block->next = not_used_next_block->next;
        if (not_used_next_block->next != NULL) {
          not_used_next_block->next->prev = block;
        }
      } else {
        block->next = NULL;
      }
      block->length += sizeof(area) + not_used_next_block->length; // *** seila que porra é essa
      memset((void *)not_used_next_block, 0, sizeof(area) + not_used_next_block->length);
      malloc_header->blocks -= 1;
    }

    if (block->prev != NULL && (block->prev)->in_use == false) {
      area *block_to_delete = block;
      block = block->prev;
      block->length += sizeof(area) + block_to_delete->length;
      block->next = block_to_delete->next;
      if (block->next != NULL) {
        block->next->prev = block;
      }
      malloc_header->blocks -= 1;
    }
    reduce_heap_size_if_possible();
  }
  malloc_header->lock = false;
  return true;
}

char *test_basic() {
  char *ptr = (char *)l_malloc(100);
  area *first_block = (void *)ptr - sizeof(area);
  assert(first_block->in_use == true);
  assert(first_block->length == 100);
  assert(first_block->next != NULL);
  assert(first_block->marker == BLOCK_MARKER);
  *ptr = 'C';
  assert(*ptr == 'C');
  return ptr;
}

void test_bigger_than_avaliable() {
  // Test allocating more memory than is currently available
  uint16_t *ptr = (uint16_t *)l_malloc(5000);
  area *first_block = (void *)ptr - sizeof(area);
  for (uint16_t i = 0; i <= 2499; i = i + 1) {
    *(ptr + i) = i;
  }
  assert(first_block->marker == BLOCK_MARKER);
  assert(first_block->in_use == true);
  assert(first_block->length == 5000);

  my_stats *malloc_header = get_malloc_header();
  assert(malloc_header->blocks == 2);
  assert(malloc_header->pages == 2);

  assert(*ptr == 0);
  assert(*(ptr + 2) == 2);
  assert(*(ptr + 2499) == 2499);

  // little endian valid only
  assert(*((uint8_t *)ptr + 4999) == (2499 >> 8));
  assert(*((uint8_t *)ptr + 4998) == (2499 & 0xFF));
}

int main() {
  char *ptr = test_basic();
  l_free(ptr);
  test_bigger_than_avaliable();
  return 0;
}