var Janken = artifacts.require("./Janken.sol");

module.exports = function(deployer) {
  deployer.deploy(Janken);
};
