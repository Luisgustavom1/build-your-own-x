import pandas as pd
import math
import numpy as np
import nltk
from nltk.corpus import stopwords
from string import punctuation

pi = math.pi

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

def matmul(A, X): 
  if (type(X) != list and len(X.shape) == 1):
    X = X.reshape(len(X), 1)

  ans = np.zeros(
    (len(A), len(X[0]))
  )
  for i in range(len(A)):
    for j in range(len(X[0])):
      for k in range(len(X)):
        ans[i][j] += A[i][k] * X[k][j]

  if(type(X) != list and ans.shape[1] == 1):
    ans = ans.reshape((len(ans)))

  return ans

# The aim of this function is to use S to make a matrix A which contains n singular 
# values on its diagonal. Rest all values are 0. Dimensions of A are m*n
# Basically, we want to make A such that multiply(U,A,V) is possible
def zero_padding(n, U, S): 
  singular_values = []
  for i in range(0, n):
    singular_values.append(S[i])

  for i in range(len(S) - n):
    singular_values.append(0)

  new_matrix = []
  for i in range(0, len(S)):
    temp = []
    for j in range(0, len(S)):
      if(j == i):
        temp.append(float(singular_values[j]))
      else:
        temp.append(float(0))
    new_matrix.append(temp)

  new_row = []
  for i in range(0, len(S)):
    new_row.append(0)

  for i in range(len(U) - len(S)):
    new_matrix.append(new_row)

  return new_matrix

# produces matrix A with m*n dimensions
def reconstruct(U, S, V, n):
  # U - matrix mxm
  # S - List of singular values
  # V - matrix nxn
  # n - number of singular values to use for reconstruction

  A = zero_padding(n, U, S)

  return np.round(matmul(matmul(U,A),V),decimals=3)

# frobenius norm of a matrix
# finds how similar two matrices are
def frobenius(matrix, matrix_2):
  temp1 = (matrix - matrix_2) ** 2
  temp2 = matrix ** 2

  sum1 = np.sum(temp1)
  sum2 = np.sum(temp2)

  return math.sqrt(sum1) / math.sqrt(sum2)

def SvD(Amatrix):
  originalMatrix = Amatrix.copy();

  ROWS = len(Amatrix)
  COLS = len(Amatrix[0])

  if (ROWS > COLS):
    Amatrix = transpose(Amatrix)

  B = Amatrix.copy()
  Amatrix = matmul(transpose(Amatrix), Amatrix)

  ROWS = len(Amatrix)
  COLS = len(Amatrix[0])

  Amatrix = np.round(Amatrix, decimals=5)
  diagonalMatrix = Amatrix.copy()
  eigenVectorsMatrix = np.zeros((ROWS, ROWS))
  for i in range(0, ROWS):
    eigenVectorsMatrix[i][i] = 1

  maximum = 1
  while (maximum > 0.001):
    maximum = math.fabs(diagonalMatrix[0][1])
    iOfMaxElement = 0
    jOfMaxElement = 1

    for i in range(0, len(diagonalMatrix)):
      for j in range(0, len(diagonalMatrix[0])):
        val = math.fabs(diagonalMatrix[i][j])
        if (i != j and val > maximum):
          maximum = val
          iOfMaxElement = i
          jOfMaxElement = j

    theta = 0
    maxOriginalElement = diagonalMatrix[iOfMaxElement][jOfMaxElement]

    if (
      diagonalMatrix[iOfMaxElement][iOfMaxElement] == diagonalMatrix[jOfMaxElement][jOfMaxElement]
    ):
      theta = pi / 4 if maxOriginalElement > 0 else -pi / 4
    else:
      val = 2 * maxOriginalElement / (
        diagonalMatrix[iOfMaxElement][iOfMaxElement] - diagonalMatrix[jOfMaxElement][jOfMaxElement]
      )
      theta = abs(0.5 * math.atan(val))

    orthogonalMatrix = np.zeros((len(diagonalMatrix), len(diagonalMatrix[0])))
    for i in range(0, len(orthogonalMatrix)):
      orthogonalMatrix[i][i] = 1

    orthogonalMatrix[iOfMaxElement][iOfMaxElement] = math.cos(theta)
    orthogonalMatrix[jOfMaxElement][jOfMaxElement] = math.cos(theta)
    orthogonalMatrix[iOfMaxElement][jOfMaxElement] = math.sin(theta)
    orthogonalMatrix[jOfMaxElement][iOfMaxElement] = -1*math.sin(theta)

    diagonalMatrix = matmul(transpose(orthogonalMatrix), diagonalMatrix)
    diagonalMatrix = matmul(diagonalMatrix, orthogonalMatrix)
    eigenVectorsMatrix = matmul(eigenVectorsMatrix, orthogonalMatrix)

  # l1 is the list of eigen values which is extracted from the diagonal of the diagonalMatrix.
  l1 = []
  for i in range(0, len(diagonalMatrix)):
    l1.append(diagonalMatrix[i][i])

  # eigenVectorsMatrix is a list of eigenvectors -- VT
  eigenVectorsMatrix=transpose(eigenVectorsMatrix) 
  tmpList = list(eigenVectorsMatrix.copy())
  for i in range(0, len(tmpList)):
    tmpList[i] = list(tmpList[i])
    tmpList[i].insert(0, l1[i])

  tmpList.sort(reverse=True)
  eigenValueslist = []
  eigenVectorslist = []
  for i in range(0, len(tmpList)):
    eigenValueslist.append(tmpList[i].pop(0))
    eigenVectorslist.append(tmpList[i])

  eigenValuesArr = np.array(eigenValueslist)
  eigenVectorsArr = np.array(eigenVectorslist)
  Umatrix = np.zeros((len(B), len(B)))
  for i in range(len(B)):
    mul = matmul((B), (eigenVectorsArr[i]))
    Umatrix[i] = mul / math.sqrt(eigenValuesArr[i])
  
  Umatrix = transpose(Umatrix)
  finEigVals = []
  for i in eigenValuesArr:
    if (i > 1e-4):
      finEigVals.append(i)

  finSingVals = [math.sqrt(i) for i in finEigVals]
  finSingVals = np.round(finSingVals, decimals=6)

  VT = eigenVectorsArr
  if (len(originalMatrix) > len(originalMatrix[0])):
    tmp = Umatrix.copy()
    Umatrix = transpose(eigenVectorsArr)
    VT = transpose(tmp)

  return Umatrix, finSingVals, VT

l_2d = X.T.values.tolist()
l_2d = np.array(l_2d)
l_2d = transpose(l_2d)
L, S, R = SvD(l_2d)

def find_k():
  for i in range(1, len(S)):
    f = frobenius(l_2d, reconstruct(L, S, R, i))
    if f < 0.35:
      return i

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