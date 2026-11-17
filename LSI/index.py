import pandas as pd
import math
import numpy as np
import nltk
from nltk.corpus import stopwords
from string import punctuation

docs = [
  "/Users/luisao/my-projects/build-your-own-x/LSI/Doc1.txt",
  "/Users/luisao/my-projects/build-your-own-x/LSI/Doc2.txt",
  "/Users/luisao/my-projects/build-your-own-x/LSI/Doc3.txt",
  "/Users/luisao/my-projects/build-your-own-x/LSI/Doc4.txt",
  "/Users/luisao/my-projects/build-your-own-x/LSI/Doc5.txt",
]

stopwords = stopwords.words('english')

def remove_punctuation(text):
  s = ""
  for c in text:
    if c not in punctuation:
      s += c
  return s

def remove_nums(text):
  s = ""
  for c in text:
    if not c.isdigit():
      s += c
  return s

def unique(bow):
  a = bow[0]
  for i in range(1, len(bow)):
    a = set(a).union(set(bow[i]))
  return a

docs_content = []
for i in range(len(docs)):
  file = open(docs[i])
  content = ''
  while 1:
    char = file.read(1)
    if char != '\n':
      content += char
    if not char:
      break
  docs_content.append(content)
  file.close()

all_words = []
for content in docs_content:
  content = remove_punctuation(remove_nums(content).lower()).split(" ")
  all_words.append(content)

# bag of words (bow)
# matrix with documents words
# [[doc1_word_1, doc1_word_2, doc1_word_3, ...], [doc2_word_1, doc2_word_2, ...]]
bow = []
for i in range(len(docs)):
  temp = []
  for word in all_words[i]:
    if word not in stopwords and len(word) > 0 and word != None:
      temp.append(word)
  bow.append(temp)

# set of all words
wordset = unique(bow)

# word frequency in each document
# [{ 'word_1': 0, 'word_2': 0 } -> doc1
# , { 'word_1': 0, 'word_2': 0 } -> doc2
# , ... ]
def calc_docs_words_freq():
  dwf = [dict.fromkeys(wordset, 0) for i in range(len(bow))]
  for bow_i, worddict_i in zip(bow, dwf):
    for word in bow_i:
      worddict_i[word] += 1

  return dwf

docs_words_freq = calc_docs_words_freq()

# Inverse Document Frequency
# Computes the inverse frequency of each word in the documents.
# { 
#   'word_1': 0, -> word_1 appears in 0 documents 
#   'word_2': 0, -> word_2 appears in 0 documents
#   'word_3': log(5/2) -> word_3 appears in 2 documents
# }
def idf(doc_list): 
  idfdict = dict.fromkeys(doc_list[0].keys(), 0)
  for words_dict in doc_list:
    for word, freq in words_dict.items():
      if freq > 0:
        idfdict[word] += 1

  for word, freq in idfdict.items():
    # TODO: understand why we are using log here
    # computes log (total num of documents/no. of documents that contain a particular word)n
    idfdict[word] = math.log(len(doc_list) / float(freq))

  return idfdict

idfs = idf(docs_words_freq)

def term_freq(worddict, bow):
  tfdict = {}
  bowcount = len(bow)
  for word, count in worddict.items():
    tfdict[word] = count / float(bowcount)
  return tfdict

tfbow = []
for i, j in zip(docs_words_freq, bow):
  tfbow.append(term_freq(i, j))

def tfidf(tfdict, idfs):
  tfidf = {}
  for word, freq in tfdict.items():
    tfidf[word] = freq * idfs[word]
  return tfidf

tfidfs = []
for i in tfbow:
  tfidfs.append(tfidf(i, idfs))

X = pd.DataFrame(tfidfs).T

def transpose(A):
  # [
  #   [1, 2, 3],
  #   [4, 5, 6]
  # ]

  # [
  #   [1, 4],
  #   [2, 5],
  #   [3, 6],
  # ]
  ans = np.zeros(
    (len(A[0]), len(A))
  )
  for i in range(len(A)):
    for j in range(len(A[0])):
      ans[j][i] = A[i][j]
  return ans

def SvD(Amatrix):
  originalMatrix = Amatrix.copy();

  ROWS = len(Amatrix)
  COLS = len(Amatrix[0])

  return 1, 2, 3

l_2d = X.T.values.tolist()
l_2d = np.array(l_2d)
l_2d = transpose(l_2d)
L, S, R = SvD(l_2d)

def find_k():
  # for i in range()
  return 1

def search(keywords):
  print(f"Searching for: {keywords}")
  q = remove_punctuation(keywords).lower().split(" ")
  terms = X.index

  query = []
  for term in terms:
    if term in q:
      query.append(1)
    else:
      query.append(0)
  
  query = np.asarray(query)

  if 1 not in query:
    print("Could not find any documents")
  else:
    k = find_k()

while (1):
  print("Please choose an option:\n"
  + "1: Search keywords \n"
  + "2: View Documents \n"
  + "3: Exit")
  opt = int(input())

  if opt == 1:
    print("Please enter the keywords to search for:")
    k = input()
    search(k)
    print("Search completed.")
  elif opt == 3:
    print("Exiting the program.")
    break
  else:
    print("Invalid option. Please try again.")