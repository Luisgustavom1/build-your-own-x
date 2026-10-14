typedef struct {
  char* key;
  char* value;
} ht_item;

typedef struct {
  int base_size;
  int size;
  int count;
  ht_item** items;
} ht_hash_table;

ht_hash_table* new_sized_ht(int base_size);
ht_hash_table* new_ht();

void ht_insert(ht_hash_table* ht, char* key, char* value);
char* ht_search(ht_hash_table* ht, char* key);
void ht_delete(ht_hash_table* ht, char* key);