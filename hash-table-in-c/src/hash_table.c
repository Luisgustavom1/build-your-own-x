#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdio.h>

#include "hash_table.h"
#include "prime.c"

#define HT_BASE_SIZE 53
#define HT_PRIME_1 163
#define HT_PRIME_2 157

static ht_item HT_DELETED_ITEM = {NULL, NULL};

void* xmalloc(size_t size) {
  void *ptr = malloc(size);
  if (ptr == NULL) {
    printf("Error: malloc failed to allocate memory\n");
    exit(EXIT_FAILURE);
  }
  return ptr;
}

void* xcalloc(size_t num, size_t size) {
  void *ptr = calloc(num, size);
  if (ptr == NULL) {
    printf("Error: calloc failed to allocate memory\n");
    exit(EXIT_FAILURE);
  }
  return ptr;
}

static ht_item* new_ht_item(char* k, char* v) {
  ht_item* item = xmalloc(sizeof(ht_item));
  item->key = strdup(k);
  item->value = strdup(v);
  return item;
}

ht_hash_table* new_sized_ht(int base_size) {
  ht_hash_table* ht = xmalloc(sizeof(ht_hash_table));
  ht->base_size = base_size;

  ht->size = next_prime(ht->base_size);

  ht->count = 0;
  ht->items = xcalloc((size_t)ht->size, sizeof(ht_item*));
  return ht;
}

ht_hash_table* new_ht() {
  return new_sized_ht(HT_BASE_SIZE);
}

static void del_ht_item(ht_item* item) {
  free(item->key);
  free(item->value);
  free(item);
}

void del_ht(ht_hash_table* ht) {
  for (int idx = 0; idx < ht->size; idx++) {
    ht_item* i = ht->items[idx];
    if (i != NULL && i != &HT_DELETED_ITEM) {
      del_ht_item(i);
    }
  }
  free(ht->items);
  free(ht);
}

static int hash(char* s, int a, int m) {
  long hash = 0;
  int len = strlen(s);
  for (int i = 0; i < len; i++) {
    hash += (pow(a, len - i+1) * s[i]);
  }
  return (int)(hash % m);
}

static int get_hash(
  char*s, int num_buckets, int attempt
) {
  int hash_a = hash(s, HT_PRIME_1, num_buckets);
  int hash_b = hash(s, HT_PRIME_2, num_buckets-1);
  return (hash_a + (attempt * (hash_b + 1))) % num_buckets;
}

static void ht_resize(ht_hash_table* ht, int base_size) {
  if (base_size < HT_BASE_SIZE) {
    return;
  }
  ht_hash_table* new_ht = new_sized_ht(base_size);
  
  for (int i = 0; i < ht->size; i++) {
    ht_item* item = ht->items[i];
    if (item != NULL && item != &HT_DELETED_ITEM) {
      ht_insert(new_ht, item->key, item->value);
    }
  }

  ht->base_size = new_ht->base_size;
  ht->count = new_ht->count;

  int tmp_size = ht->size;
  ht->size = new_ht->size;
  new_ht->size = tmp_size;

  ht_item** tmp_items = ht->items;
  ht->items = new_ht->items;
  new_ht->items = tmp_items;

  del_ht(new_ht);
}

static void ht_resize_up(ht_hash_table* ht) {
  int new_size = ht->base_size * 2;
  ht_resize(ht, new_size);
}

static void ht_resize_down(ht_hash_table* ht) {
  int new_size = ht->base_size / 2;
  ht_resize(ht, new_size);
}

void ht_insert(ht_hash_table* ht, char* key, char* value) {
  int load = ht->count*100/ht->size;
  if (load > 70) {
    ht_resize_up(ht);
  }

  ht_item* item = new_ht_item(key, value);
  int index = get_hash(item->key, ht->size, 0);
  ht_item* cur_item = ht->items[index];
  int i = 1;
  while (cur_item != NULL) {
    if (cur_item != &HT_DELETED_ITEM) {
      if (strcmp(cur_item->key, key) == 0) {
        del_ht_item(cur_item);
        ht->items[index] = item;
        return;
      }
    }
    index = get_hash(item->key, ht->size, i);
    cur_item = ht->items[index];
    i++;
  }
  ht->items[index] = item;
  ht->count++;
}

char* ht_search(ht_hash_table* ht, char* key) {
  int index = get_hash(key, ht->size, 0);
  ht_item* item = ht->items[index];
  int i = 1;
  while (item != NULL) {
    if (item != &HT_DELETED_ITEM) {
      if (strcmp(item->key, key) == 0) {
        return item->value;
      }
    }
    index = get_hash(key, ht->size, i);
    item = ht->items[index];
    i++;
  }
  return NULL;
}

void ht_delete(ht_hash_table* ht, char* key) {
  int load = ht->count*100 / ht->size;
  if (load < 10) {
    ht_resize_down(ht);
  }
  
  int index = get_hash(key, ht->size, 0);
  ht_item* item = ht->items[index];
  int i = 1;
  while (item != NULL) {
    if (item != &HT_DELETED_ITEM) {
      if (strcmp(item->key, key) == 0) {
        del_ht_item(item);
        ht->items[index] = &HT_DELETED_ITEM;
        ht->count--;
        return;
      }
    }

    index = get_hash(key, ht->size, i);
    item = ht->items[index];
    i++;
  }
  ht->count--;
}

