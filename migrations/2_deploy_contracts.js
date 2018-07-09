var SafeMath = artifacts.require("./SafeMath.sol");
var Auction = artifacts.require("./Auction.sol");

module.exports = function(deployer) {
	deployer.deploy(SafeMath);
	deployer.link(SafeMath, Auction);

	// Initialising the contract
	deployer.deploy(
		Auction,					// Name of the contract 
		"Lamborghini Aventador",	// Item up for auction
		1,							// Condition of the item (0:Brand New, 1:Like New, 2:Very Good, 3:Good, 4:Acceptable)
		240,						// Auction duration specified in minutes
		web3.toWei(1, "ether"),		// Auction start price specified in wei (1000000000000000000 wei is 1 ether)
		web3.toWei(50, "ether") 		// Auction buy price specified in wei (50000000000000000000 is 50 ether)
	);
};