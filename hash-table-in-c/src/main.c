#include "hash_table.c"
#include <stdio.h>

int main(void) {
  ht_hash_table* ht = new_ht();
  ht_insert(ht, "name", "John");
  ht_insert(ht, "age", "30");
  ht_insert(ht, "city", "New York");

  printf("Name: %s\n", ht_search(ht, "name"));
  printf("Age: %s\n", ht_search(ht, "age"));
  printf("City: %s\n", ht_search(ht, "city"));
  printf("len: %d\n", ht->count);
  
  ht_delete(ht, "age");
  printf("Age after deletion: %s\n", ht_search(ht, "age"));
  printf("len: %d\n", ht->count);
  
  ht_insert(ht, "age", "31");
  printf("Age after insertion: %s\n", ht_search(ht, "age"));
  
  ht_insert(ht, "age", "32");
  printf("Age after update: %s\n", ht_search(ht, "age"));
  
  for (int i = 0; i < 100; i++) {
    char key[10];
    char value[10];
    sprintf(key, "key%d", i);
    sprintf(value, "value%d", i);
    ht_insert(ht, key, value);
  }

  printf("len: %d\n", ht->count);
  printf("Size: %d\n", ht->size);
  printf("Size: %d\n", ht->base_size);
  printf("Value for key50: %s\n", ht_search(ht, "key50"));

  for (int i = 0; i < 100; i++) {
    char key[10];
    sprintf(key, "key%d", i);
    ht_delete(ht, key);
  }

  printf("len: %d\n", ht->count);
  printf("Size: %d\n", ht->size);
  printf("Size: %d\n", ht->base_size);
  printf("Value for key50: %s\n", ht_search(ht, "key50"));

  del_ht(ht);
  return 0;
}