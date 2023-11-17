//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SmartEscrow is Ownable {
	
	enum Status {
		OPEN,
		PAID,
		CONFIRMED,
		COMPLETED,
		REFUNDED,
		CANCELED
	}
	
	struct Escrow {
		address buyer;
		address payable seller;
		uint256 amount;
		Status escrowStatus;
		string title;
		string description;
	}
	
	mapping(uint256 => Escrow) public escrows;
	uint256 public escrowCount;
	IERC20 public token;

	
	constructor(IERC20 _token) Ownable(msg.sender) {
		token = _token;
	}

	function beginEscrow(
		address payable _seller,
		uint256 _amount,
		string calldata _title,
		string calldata _description
	) external {
		escrows[escrowCount] = Escrow(
			address(0x0),
			_seller,
			_amount,
			Status.OPEN,
			_title,
			_description
		);
		escrowCount++;
	}

	function fundEscrow(
		uint256 _escrowId
	) external checkIfSmartEscrowExists(_escrowId) {
		Escrow storage escrow = escrows[_escrowId];
		require(
			escrow.escrowStatus == Status.OPEN,
			"Funds have been released"
		);
		escrow.escrowStatus = Status.PAID;
		escrow.buyer = msg.sender;
		token.transferFrom(msg.sender, address(this), escrow.amount);
	}

	function confirmEscrow(
		uint256 _escrowId
	) external checkIfSmartEscrowExists(_escrowId) {
		Escrow storage escrow = escrows[_escrowId];
		require(
			escrow.escrowStatus == Status.PAID,
			"Funds have been released"
		);
		require(
			msg.sender == escrow.buyer,
			"Only the buyer can confirm that purchase was completed"
		);
		escrow.escrowStatus = Status.CONFIRMED;
	}

	function finishEscrow(
		uint256 _escrowId
	) external checkIfSmartEscrowExists(_escrowId) {
		Escrow storage escrow = escrows[_escrowId];
		require(
			msg.sender == escrow.seller,
			"Only the seller can release funds"
		);
		require(
			escrow.escrowStatus == Status.CONFIRMED,
			"Escrow state has to be set to confirmed"
		);
		escrow.escrowStatus = Status.COMPLETED;
		token.transfer(escrow.seller, escrow.amount);
	}

	function undoEscrow(
		uint256 _escrowId
	) external checkIfSmartEscrowExists(_escrowId) {
		Escrow storage escrow = escrows[_escrowId];
		require(
			msg.sender == escrow.seller,
			"Only the seller can cancel escrow"
		);
		require(
			escrow.escrowStatus == Status.OPEN,
			"Escrow can only be canceled when it's state is open"
		);
		escrow.escrowStatus = Status.CANCELED;
	}

	
	modifier checkIfSmartEscrowExists(uint256 _escrowId) {
		require(
			_escrowId < escrowCount,
			"does not exist"
		);
		_;
	}
}