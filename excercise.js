const tripleNumber = (number) => {
  let newArray = [];

  for (let i = 0; i < number.length; i++) {
    newArray.push(number[i] * 3);
  }

  return newArray;
};

console.log(tripleNumber([1, 2, 3, 4, 5]));
