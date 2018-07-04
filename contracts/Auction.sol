pragma solidity ^0.4.24;

import "./SafeMath.sol";

contract Auction {
    
    // OpenZeppelin SafeMath library
    using SafeMath for uint256;
    
    // Variables
    address public owner;
    string public itemName;
    enum Conditions {BrandNew, LikeNew, VeryGood, Good, Acceptable}
    Conditions public condition;
    uint public auctionEndTime;
    uint public startPrice;
    uint public buyPrice;
    uint public bidCount;
    address public highestBidder;
    uint public highestBid;
    bool public ended;
    mapping(address => uint) public pendingWithdrawals;
    
    // Events
    event AuctionStarted(string bidItem);
    event AuctionEnded(address winner, uint bidAmount);
    event HighestBidIncreased(address bidder, uint bidAmount);
    event AuctionCancelled();
    event Withdrawal(string message, address withdrawAccount, uint withdrawAmount);
    
    // Checks that it is the owner of the contract
    modifier ownerOnly() {
        require(msg.sender == owner);
        _;
    }
    
    // Checks that the auction is active
    modifier isActive() {
        require(!ended, "Auction has already ended.");
        require(now < auctionEndTime, "Auction end time has already been reached.");
        _;
    }
    
    // Seting up the auction
    constructor(string _itemName, Conditions _condition, uint _startPrice, uint _buyPrice, uint _durationMinutes) public {
        
        require(_durationMinutes > 0, "Duration must be above 0.");
        require(_startPrice >= 0 && _buyPrice > 0, "Start and buy price must be above 0."); 
        require(_startPrice < _buyPrice, "Buy price must be higher than the start price.");
        owner = msg.sender;
        itemName = _itemName;
        condition = _condition;
        startPrice = _startPrice;
        buyPrice = _buyPrice;
        auctionEndTime = now + (_durationMinutes * 1 minutes);
        emit AuctionStarted(itemName);
    }
    
    // Placing a bid
    function placeBid() public payable isActive {
        
        require(msg.sender != owner, "Bidding on your own items is NOT allowed.");
        require(msg.value >= startPrice && msg.value > highestBid, "Bid price is too low.");
        
        bidCount++;
        
        if(highestBid != 0) {
            pendingWithdrawals[highestBidder] = pendingWithdrawals[highestBidder].add(highestBid);
        }
        
        highestBidder = msg.sender;
        highestBid = msg.value;
        
        if(msg.value >= buyPrice) {
            highestBid = buyPrice;
            pendingWithdrawals[highestBidder] = pendingWithdrawals[highestBidder].add(msg.value - buyPrice);
            itemBought();
        }

        emit HighestBidIncreased(highestBidder, highestBid);
    }
    
    // End the auction
    function endAuction() public ownerOnly {
        require(!ended, "Auction has ended.");
        require(now >= auctionEndTime, "Auction end time has not been reached.");
        ended = true;
        pendingWithdrawals[owner] = highestBid;
        emit AuctionEnded(highestBidder, highestBid);
    }
    
    // Item bought
    function itemBought() private {
        ended = true;
        pendingWithdrawals[owner] = highestBid;
        emit AuctionEnded(highestBidder, highestBid);    
    }
    
    // Cancel the auction
    function cancelAuction() public ownerOnly isActive {
        pendingWithdrawals[highestBidder] = pendingWithdrawals[highestBidder].add(highestBid);
        ended = true;
        emit AuctionCancelled();
    }
    
    // Let users withdraw money by themselves
    function withdraw() public returns (bool) {
        
        uint amount = pendingWithdrawals[msg.sender];
        
        if(amount > 0) {
            pendingWithdrawals[msg.sender] = 0;
            if(!msg.sender.send(amount)) {
                pendingWithdrawals[msg.sender] = amount;
                emit Withdrawal("Failed", msg.sender, amount);
                return false;
            }
        }
        emit Withdrawal("Completed", msg.sender, amount);
        return true;
    }
    
    // Get the time remaining for the auction
    function timeRemaining() public view isActive returns (uint) {
        return auctionEndTime - now;
    }
}
