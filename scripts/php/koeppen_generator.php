<?php
// pour découper le CSV de cette page http://koeppen-geiger.vu-wien.ac.at/present.htm et en faire un JSON contenant moins d'informations

$inputFile = "/Applications/MAMP/htdocs/map.corentinrobin.com/data/Koeppen-Geiger-ASCII.txt";
$outputFile = "/Applications/MAMP/htdocs/map.corentinrobin.com/data/climate.json";

echo "LECTURE DE " . $inputFile . "...\n";

$file = fopen($inputFile, "r");

$output = ["points" => []];

// on ne garde pas l'entête
$line = fgets($file);

$c = 0;
$i = 0;

while(!feof($file))
{
	$line = fgets($file);
	$c++;

	// on ne prend qu'une valeur sur 5 pour ne pas avoir un fichier énorme...
	if($c % 5 == 0)
	{
		$i++;
	    $data = preg_split("/ {1,}/", $line);
	    $array = [floatval($data[1]), floatval($data[2]), str_replace("\r\n", "", $data[3])];
	    array_push($output["points"], $array);
	}
}

fclose($file);

echo $i . " POINTS RECUPERES SUR " . $c . "...\n";

echo "ECRITURE DE " . $outputFile . "...\n";

file_put_contents($outputFile, json_encode($output));
?>